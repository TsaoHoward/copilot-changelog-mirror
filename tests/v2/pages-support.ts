import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { StageFixture, artifactZip } from "./stage-support.js";
import { root, serve } from "./support.js";
import { fixtureEnvironment } from "./environment-support.js";
const run = promisify(execFile);
export class PagesFixture extends StageFixture {
  records = new Map<number, any>();
  attempts = new Map<string, any>();
  jobs = new Map<string, any[]>();
  artifacts: any[] = [];
  requests: string[] = [];
  api = "";
  apiStatus = 0;
  onRequest: ((path: string) => void) | undefined;
  deploymentCalls: any[] = [];
  payloads = new Map<number, Buffer>();
  pagesState = join(this.dir, "pages.json");
  current = { run_id: 70, attempt: 1 };
  nextId = 20;
  async init(t: TestContext, empty = false) {
    for (const name of [
      ".gitignore",
      "site",
      "package-lock.json",
      "tsconfig.json",
      ".node-version",
      "site-build.json",
      ".github",
    ])
      cpSync(join(root, name), join(this.repo, name), { recursive: true });
    this.git(
      "add",
      ".gitignore",
      "site",
      "package-lock.json",
      "tsconfig.json",
      ".node-version",
      "site-build.json",
      ".github",
    );
    this.git("commit", "-qm", "Pages application and definition");
    const source = this.source(
      "article.html",
      "<article><h1>Saved article</h1><p>Publication body.</p></article>",
    );
    const captured = await this.stage("capture", [
      "--definition-repo",
      this.repo,
      "--feed-url",
      this.feed(empty ? "" : `<item><link>${source}</link></item>`),
    ]);
    if (captured.code) throw new Error(captured.stderr);
    const rendered = await this.stage("render", [
      "--definition-repo",
      this.repo,
      "--run-id",
      "2",
      "--advance",
      "true",
    ]);
    if (rendered.code) throw new Error(rendered.stderr);
    this.addStage(rendered.result);
    this.addCurrent();
    this.api = await serve(t, (req, res) => {
      this.requests.push(req.url!);
      this.onRequest?.(req.url!);
      if (this.apiStatus) {
        res.writeHead(this.apiStatus).end("injected failure");
        return;
      }
      const page = Number(
        new URL(req.url!, "http://fixture").searchParams.get("page") ?? 1,
      );
      const paginate = (items: any[]) =>
        items.slice((page - 1) * 100, page * 100);
      const path = req.url!.replace("/repos/fixture/archive", "");
      const exact = path.match(
        /^\/actions\/runs\/(\d+)\/attempts\/(\d+)(\/jobs)?(?:\?.*)?$/,
      );
      if (exact) {
        const key = `${exact[1]}/${exact[2]}`;
        const value = exact[3]
          ? { jobs: paginate(this.jobs.get(key) ?? []) }
          : this.attempts.get(key);
        if (!value) res.writeHead(404).end("missing");
        else res.end(JSON.stringify(value));
      } else if (path.startsWith("/actions/workflows/")) {
        const workflow = path.split("/")[3];
        const latest = new Map<number, any>();
        for (const r of this.attempts.values())
          if (
            r.path.endsWith(workflow!) &&
            (!latest.has(r.id) || latest.get(r.id).run_attempt < r.run_attempt)
          )
            latest.set(r.id, r);
        res.end(
          JSON.stringify({ workflow_runs: paginate([...latest.values()]) }),
        );
      } else if (/^\/actions\/runs\/\d+\/artifacts/.test(path)) {
        const id = Number(path.split("/")[3]);
        res.end(
          JSON.stringify({
            artifacts: paginate(
              this.artifacts.filter((a) => a.workflow_run.id === id),
            ),
          }),
        );
      } else if (/^\/actions\/artifacts\/\d+\/zip$/.test(path)) {
        const record = this.records.get(Number(path.split("/")[3]));
        if (!record) res.writeHead(404).end("missing");
        else
          res.end(
            this.payloads.get(Number(path.split("/")[3])) ??
              artifactZip(record, record.kind ? "pages.json" : "stage.json"),
          );
      } else res.writeHead(404).end("unexpected");
    });
    return rendered.result;
  }
  runMeta(
    ref: { run_id: number; attempt: number },
    workflow: string,
    status = "completed",
    conclusion: string | null = "success",
  ) {
    return {
      id: ref.run_id,
      run_attempt: ref.attempt,
      status,
      conclusion,
      head_branch: "main",
      head_sha: this.text("rev-parse", "HEAD"),
      path: `.github/workflows/${workflow}`,
      event: "workflow_dispatch",
      repository: { full_name: "fixture/archive" },
      head_repository: { full_name: "fixture/archive" },
    };
  }
  addCurrent() {
    this.attempts.set(
      `${this.current.run_id}/${this.current.attempt}`,
      this.runMeta(this.current, "v2-pages.yml", "in_progress", null),
    );
  }
  addArtifact(
    name: string,
    ref: { run_id: number; attempt: number },
    record?: any,
  ) {
    const id = this.nextId++;
    this.artifacts.push({
      id,
      name,
      expired: false,
      expires_at: "2099-01-01T00:00:00Z",
      workflow_run: {
        id: ref.run_id,
        head_sha: this.text("rev-parse", "HEAD"),
        head_branch: "main",
      },
    });
    if (record) this.records.set(id, structuredClone(record));
    return id;
  }
  addStage(record: any) {
    this.attempts.set(
      `${record.run_id}/${record.attempt}`,
      this.runMeta(record, `v2-${record.stage}.yml`),
    );
    this.addArtifact(
      `v2-stage-${record.stage}-${record.run_id}-${record.attempt}`,
      record,
      record,
    );
  }
  job(name: string, steps: string[], time = "2026-10-12T00:00:00Z") {
    return {
      id: this.nextId++,
      name,
      run_id: this.current.run_id,
      run_attempt: this.current.attempt,
      status: "completed",
      conclusion: "success",
      steps: steps.map((name, i) => ({
        name,
        number: i + 1,
        status: "completed",
        conclusion: "success",
        completed_at: time,
      })),
    };
  }
  async pages(
    command: string,
    extra: string[] = [],
    state = this.pagesState,
    env: NodeJS.ProcessEnv = {},
  ) {
    let output;
    try {
      output = {
        code: 0,
        ...(await run(
          process.execPath,
          [
            "--import",
            "tsx",
            join(root, "src/v2/pages-cli.ts"),
            command,
            "--repo",
            this.repo,
            "--definition-repo",
            this.repo,
            "--repository",
            "fixture/archive",
            "--archive-branch",
            this.branch,
            "--state",
            state,
            "--run-id",
            String(this.current.run_id),
            "--attempt",
            String(this.current.attempt),
            ...extra,
          ],
          {
            cwd: root,
            env: fixtureEnvironment({
              GITHUB_API_URL: this.api,
              GH_TOKEN: "fixture-secret",
              COPILOT_NETWORK_LOG: join(this.dir, "pages-network.log"),
              ...env,
            }),
            maxBuffer: 8_000_000,
          },
        )),
      };
    } catch (e: any) {
      output = { code: e.code, stdout: e.stdout, stderr: e.stderr };
    }
    return {
      ...output,
      result: output.stdout ? JSON.parse(output.stdout) : null,
    };
  }
  pagesRecord() {
    return JSON.parse(readFileSync(this.pagesState, "utf8"));
  }
  async prepared(extra: string[] = []) {
    let r = await this.pages("select", [
      "--render-run",
      "2",
      "--render-attempt",
      "1",
      ...extra,
    ]);
    if (r.code) throw new Error(r.stderr);
    r = await this.pages("prepare", [
      "--installed",
      "--output",
      join(this.dir, `output-${this.current.run_id}-${this.current.attempt}`),
    ]);
    if (r.code) throw new Error(r.stderr);
    const id = this.addArtifact(
      `v2-pages-build-${this.current.run_id}-${this.current.attempt}`,
      this.current,
    );
    this.jobs.set(`${this.current.run_id}/${this.current.attempt}`, [
      this.job("prepare", [
        "Build selected site",
        "Upload Pages artifact",
        "Record preparation",
        "Publish preparation evidence",
      ]),
    ]);
    r = await this.pages("bind", ["--artifact-id", String(id)]);
    if (r.code) throw new Error(r.stderr);
    this.addArtifact(
      `v2-pages-preparation-${this.current.run_id}-${this.current.attempt}`,
      this.current,
      r.result,
    );
    return r.result;
  }
  hostedDeployment(result: any) {
    if (result.outcome !== "authorized") return false;
    this.deploymentCalls.push({
      artifact: structuredClone(result.artifact),
      deployment: structuredClone(result.deployment),
    });
    return true;
  }
  async deploy(time?: string, extra: string[] = []) {
    const prep = await this.prepared(extra);
    const authorized = await this.pages("authorize", [
      "--preparation-run",
      String(prep.preparation.run_id),
      "--preparation-attempt",
      String(prep.preparation.attempt),
    ]);
    if (authorized.code) throw new Error(authorized.stderr);
    if (!this.hostedDeployment(authorized.result)) return authorized.result;
    const job = this.job(
      "deploy",
      [
        "Deploy Pages",
        "Record deployment",
        "Publish deployment evidence",
        "Report evidence publication outcome",
      ],
      time,
    );
    this.jobs.get(`${this.current.run_id}/${this.current.attempt}`)!.push(job);
    const reported = await this.pages("report", [
      "--url",
      "https://fixture.invalid/site/",
      "--job-id",
      String(job.id),
    ]);
    if (reported.code) throw new Error(reported.stderr);
    this.addArtifact(
      `v2-pages-result-${this.current.run_id}-${this.current.attempt}`,
      this.current,
      reported.result,
    );
    this.attempts.set(
      `${this.current.run_id}/${this.current.attempt}`,
      this.runMeta(this.current, "v2-pages.yml"),
    );
    return reported.result;
  }
}
