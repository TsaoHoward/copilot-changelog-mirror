import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { root } from "./support.js";

const template = join(root, ".github/isolated/update-publish.yml");
const load = () => parse(readFileSync(template, "utf8"));

test("isolated native workflow has inactive production scheduling and guarded two-job permissions", () => {
  const w = load();
  assert.deepEqual(w.on.schedule, [
    { cron: "17 6,12 * * *", timezone: "Asia/Taipei" },
  ]);
  for (const file of readdirSync(join(root, ".github/workflows"))) {
    const active = parse(
      readFileSync(join(root, ".github/workflows", file), "utf8"),
    );
    assert.notEqual(
      active.name,
      w.name,
      "replacement must remain outside registered production workflows",
    );
  }
  assert.deepEqual(w.on.workflow_dispatch.inputs.mode.options, [
    "full-update",
    "render-rebuild",
    "republish",
  ]);
  assert.equal(w.on.workflow_dispatch.inputs.mode.default, "full-update");
  assert.deepEqual(w.concurrency, {
    group: "isolated-directory-archive-pages",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(w.permissions, { contents: "read" });
  assert.deepEqual(Object.keys(w.jobs), ["archive-build", "deploy"]);
  for (const job of Object.values(w.jobs) as any[]) {
    assert.match(
      job.if,
      /github.repository == 'TsaoHoward\/copilot-changelog-isolated-35'/,
    );
    assert.match(job.if, /github.event.repository.default_branch/);
    assert.match(job.if, /github.event_name == 'schedule'/);
    assert.match(job.if, /github.event_name == 'workflow_dispatch'/);
    assert.equal(job.concurrency, undefined);
  }
  assert.deepEqual(w.jobs["archive-build"].permissions, { contents: "write" });
  assert.deepEqual(w.jobs.deploy.permissions, {
    pages: "write",
    "id-token": "write",
  });
  assert.equal(w.jobs.deploy.needs, "archive-build");
  assert.equal(w.jobs.deploy.environment.name, "github-pages");
  const deploy = w.jobs.deploy.steps.find((s: any) =>
    s.uses?.startsWith("actions/deploy-pages@"),
  );
  const upload = w.jobs["archive-build"].steps.find((s: any) =>
    s.uses?.startsWith("actions/upload-pages-artifact@"),
  );
  assert.equal(deploy.with.artifact_name, upload.with.name);
  assert.equal(upload.with.path, "${{ runner.temp }}/site");
  assert.ok(
    w.jobs.deploy.steps.every(
      (s: any) =>
        !s.uses?.startsWith("actions/checkout@") && !s.run?.includes("npm"),
    ),
  );
});

test("isolated workflow pins inputs and strictly sequences stage persistence, finished build and native upload", () => {
  const w = load();
  const steps = w.jobs["archive-build"].steps;
  const index = (id: string) => steps.findIndex((s: any) => s.id === id);
  const ids = [
    "entry",
    "application",
    "archive",
    "capture",
    "capture-push",
    "render",
    "render-push",
    "build",
    "upload",
  ];
  assert.ok(ids.every((id) => index(id) >= 0));
  assert.deepEqual(
    ids.map(index),
    ids.map(index).toSorted((a, b) => a - b),
  );
  const byId = (id: string) => steps[index(id)];
  assert.match(byId("entry").run, /schedule/);
  assert.match(byId("entry").run, /merge-base --is-ancestor/);
  assert.match(byId("entry").run, /archive_sha is only valid for republish/);
  assert.equal(
    byId("application").with.ref,
    "${{ steps.entry.outputs.application }}",
  );
  assert.equal(byId("application").with["persist-credentials"], false);
  assert.equal(byId("archive").with.ref, "mirror-data-v2");
  assert.notEqual(byId("application").with.path, byId("archive").with.path);
  for (const id of ["capture", "capture-push"])
    assert.equal(byId(id).if, "steps.entry.outputs.mode == 'full-update'");
  for (const id of ["render", "render-push"])
    assert.equal(byId(id).if, "steps.entry.outputs.mode != 'republish'");
  assert.match(byId("capture").run, /capture:directory/);
  assert.match(byId("render").run, /render:directory/);
  assert.match(byId("capture-push").run, /persist-stage.sh" capture/);
  assert.match(byId("render-push").run, /persist-stage.sh" render/);
  assert.match(byId("build").run, /site:build:directory/);
  assert.match(byId("build").run, /--archive-dir.*--output.*--base.*--site/s);
  for (const step of steps.filter((s: any) => ids.includes(s.id))) {
    assert.equal(step["continue-on-error"], undefined);
    assert.doesNotMatch(step.if ?? "", /always|failure|changed/);
  }
  const selected = steps.find((s: any) => s.id === "selected");
  assert.match(selected.run, /git symbolic-ref --short HEAD/);
  assert.match(selected.run, /git rev-parse HEAD/);
  assert.match(selected.run, /git checkout --detach/);
  assert.match(selected.run, /merge-base --is-ancestor/);
  assert.doesNotMatch(
    JSON.stringify(w),
    /workflow_run|actions:.*read|stage --|pages --|cutover --|force-push|git rebase/,
  );
});

test("the actual entry shell accepts schedule/manual defaults and rejects unsafe selections before archive credentials", async (t) => {
  const { execFileSync, spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "copilot-entry-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const control = join(dir, "control");
  const remote = join(dir, "remote.git");
  mkdirSync(control);
  const gitEnv = { ...process.env, GIT_ALLOW_PROTOCOL: "file" };
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: control,
      env: gitEnv,
      stdio: "pipe",
    })
      .toString()
      .trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Entry fixture");
  git("config", "user.email", "entry@example.invalid");
  // Entry checks compatibility paths and npm script names; it executes no CLI.
  for (const file of [
    "package.json",
    "src/v2/capture-directory-cli.ts",
    "src/v2/render-directory-cli.ts",
    "src/v2/native-site-cli.ts",
  ]) {
    mkdirSync(dirname(join(control, file)), { recursive: true });
    writeFileSync(join(control, file), readFileSync(join(root, file)));
  }
  git("add", ".");
  git("commit", "-qm", "Trusted application commands");
  const trustedApplication = git("rev-parse", "HEAD");
  git("commit", "--allow-empty", "-qm", "Trusted workflow revision");
  const sha = git("rev-parse", "HEAD");
  git("init", "--bare", "-q", "--initial-branch=main", remote);
  git("remote", "add", "origin", remote);
  git("push", "-q", "origin", "main");
  git("fetch", "-q", "origin", "main");
  assert.equal(git("rev-parse", "refs/remotes/origin/main"), sha);
  // This object exists and has all commands, but is outside trusted main history.
  git("switch", "-qc", "untrusted");
  git("commit", "--allow-empty", "-qm", "Untrusted application revision");
  const untrustedApplication = git("rev-parse", "HEAD");
  git("switch", "-q", "main");

  const script = load().jobs["archive-build"].steps.find(
    (s: any) => s.id === "entry",
  ).run;
  const env = {
    ...gitEnv,
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "35",
    GITHUB_REPOSITORY: "TsaoHoward/copilot-changelog-isolated-35",
    GITHUB_REF: "refs/heads/main",
    DEFAULT_BRANCH: "main",
    GITHUB_SHA: sha,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    REQUESTED_MODE: "",
    REQUESTED_APPLICATION: "",
    REQUESTED_ARCHIVE: "",
    GITHUB_OUTPUT: join(dir, "outputs"),
    GITHUB_STEP_SUMMARY: join(dir, "summary"),
  };
  const runEntry = (extra: NodeJS.ProcessEnv) => {
    writeFileSync(env.GITHUB_OUTPUT, "");
    writeFileSync(env.GITHUB_STEP_SUMMARY, "");
    return spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: control,
      env: { ...env, ...extra },
      encoding: "utf8",
    });
  };
  for (const [extra, mode, application] of [
    [{}, "full-update", sha],
    [{ GITHUB_EVENT_NAME: "schedule" }, "full-update", sha],
    [{ REQUESTED_MODE: "full-update" }, "full-update", sha],
    [{ REQUESTED_MODE: "render-rebuild" }, "render-rebuild", sha],
    [{ REQUESTED_MODE: "republish" }, "republish", sha],
    [{ REQUESTED_MODE: "republish", REQUESTED_ARCHIVE: sha }, "republish", sha],
    [
      { REQUESTED_APPLICATION: trustedApplication },
      "full-update",
      trustedApplication,
    ],
  ] as const) {
    const result = runEntry(extra);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(env.GITHUB_OUTPUT, "utf8"),
      `mode=${mode}\napplication=${application}\n`,
    );
  }
  for (const extra of [
    { GITHUB_REPOSITORY: "TsaoHoward/copilot-changelog-mirror" },
    { GITHUB_REF: "refs/heads/feature" },
    { DEFAULT_BRANCH: "other" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { REQUESTED_MODE: "capture-only" },
    { REQUESTED_ARCHIVE: sha },
    { REQUESTED_APPLICATION: "main" },
    { REQUESTED_APPLICATION: "a".repeat(40) },
    { REQUESTED_APPLICATION: untrustedApplication },
    { GITHUB_SHA: untrustedApplication },
    { REQUESTED_MODE: "republish", REQUESTED_ARCHIVE: "main" },
  ]) {
    const result = runEntry(extra);
    assert.ok(
      result.status !== null && result.status !== 0,
      `${JSON.stringify(extra)}: ${result.stderr}`,
    );
    assert.equal(readFileSync(env.GITHUB_OUTPUT, "utf8"), "");
    assert.equal(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8"), "");
  }
  // This executes the shipped shell using only fixture refs and file transport.
  // It does not simulate Actions schedule registration or expression evaluation.
});
