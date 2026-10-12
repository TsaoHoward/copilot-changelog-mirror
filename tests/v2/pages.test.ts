import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PagesFixture } from "./pages-support.js";

test("real Pages command builds exact Astro publication; verified success suppresses a second build and deployment", async (t) => {
  const f = new PagesFixture(t);
  const render = await f.init(t);
  const before = f.remoteTip();
  const application = f.text("rev-parse", "HEAD");
  const result = await f.deploy();
  assert.equal(result.outcome, "deployed");
  assert.equal(result.archive_revision, render.archive_output);
  assert.equal(result.publication_identity, render.publication_output);
  const output = join(f.dir, "output-70-1");
  assert.match(
    readFileSync(join(output, "index.html"), "utf8"),
    /Publication body|Saved article/,
  );
  assert.ok(existsSync(join(output, "pagefind/pagefind.js")));
  assert.equal(f.remoteTip(), before);
  assert.equal(f.text("rev-parse", "HEAD"), application);
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const duplicate = await f.pages("select", [
    "--render-run",
    "2",
    "--render-attempt",
    "1",
  ]);
  assert.equal(duplicate.code, 0, duplicate.stderr);
  assert.equal(duplicate.result.outcome, "duplicate");
  assert.deepEqual(duplicate.result.baseline.deployment, {
    run_id: 70,
    attempt: 1,
  });
  assert.equal(
    f.requests.filter((x) => x.endsWith("/zip") && x.includes("/artifacts/"))
      .length > 0,
    true,
  );
});

test("expired build artifact preserves baseline; expired result blocks ordinary and force, explicit recovery establishes a new baseline", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const first = await f.deploy();
  f.artifacts.find((a) => a.id === first.artifact.id)!.expired = true;
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  let result = await f.pages("select");
  assert.equal(result.result.outcome, "duplicate", result.stderr);
  f.artifacts.find((a) => a.name === "v2-pages-result-70-1")!.expired = true;
  for (const extra of [[], ["--force"]]) {
    result = await f.pages("select", extra);
    assert.notEqual(result.code, 0);
    assert.match(result.result.diagnostic, /baseline-evidence-unavailable/);
  }
  const recovered = await f.deploy("2026-10-13T00:00:00Z", ["--reestablish"]);
  assert.equal(recovered.recovery, "reestablish");
  assert.equal(recovered.recovery_reason, "baseline-evidence-expired");
  assert.deepEqual(recovered.baseline.deployment, { run_id: 70, attempt: 1 });
  f.current = { run_id: 72, attempt: 1 };
  f.addCurrent();
  result = await f.pages("select");
  assert.equal(result.result.outcome, "duplicate", result.stderr);
  assert.deepEqual(result.result.baseline.deployment, {
    run_id: 71,
    attempt: 1,
  });
});

test("raw chrome, unused discovery and capture observations persist without another Pages build or deployment", async (t) => {
  const f = new PagesFixture(t);
  const original = await f.init(t);
  const first = await f.deploy();
  const metadataBefore = f.git(
    "show",
    `${original.archive_output}:metadata.json`,
  );
  const historyBefore = f.text("rev-list", "--count", original.archive_output);
  const unchangedSource = f.source(
    "article.html",
    "<article><h1>Saved article</h1><p>Publication body.</p></article>",
  );
  const unchanged = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--feed-url",
      f.feed(`<item><link>${unchangedSource}</link></item>`),
    ],
    { COPILOT_CAPTURE_NOW: "2026-10-12T11:00:00.000Z" },
  );
  assert.equal(unchanged.code, 0, unchanged.stderr);
  assert.equal(unchanged.result.outcome, "no-change");
  assert.equal(f.remoteTip(), original.archive_output);
  assert.deepEqual(
    f.git("show", `${f.remoteTip()}:metadata.json`),
    metadataBefore,
  );
  assert.equal(f.text("rev-list", "--count", f.remoteTip()!), historyBefore);
  const bodyBefore = f
    .git(
      "show",
      `${original.archive_output}:posts/${Object.keys(JSON.parse(f.git("show", `${original.archive_output}:metadata.json`).toString()).articles)[0]}.md`,
    )
    .toString();
  const source = f.source(
    "article.html",
    "<nav>New source chrome</nav><article><h1>Saved article</h1><p>Publication body.</p></article>",
  );
  const captured = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--run-id",
      "3",
      "--feed-url",
      f.feed(`<item><link>${source}</link></item>`),
    ],
    { COPILOT_CAPTURE_NOW: "2026-10-12T12:00:00.000Z" },
  );
  assert.equal(captured.code, 0, captured.stderr);
  assert.notEqual(captured.result.archive_output, original.archive_output);
  const rendered = await f.stage("render", [
    "--definition-repo",
    f.repo,
    "--run-id",
    "4",
    "--advance",
    "true",
  ]);
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(rendered.result.publication_output, original.publication_output);
  f.addStage(rendered.result);
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const duplicate = await f.pages("select", [
    "--render-run",
    "4",
    "--render-attempt",
    "1",
  ]);
  assert.equal(duplicate.code, 0, duplicate.stderr);
  assert.equal(duplicate.result.outcome, "duplicate");
  assert.equal(duplicate.result.deployment_identity, first.deployment_identity);
  assert.equal(
    f
      .git(
        "show",
        `${rendered.result.archive_output}:posts/${Object.keys(JSON.parse(f.git("show", `${original.archive_output}:metadata.json`).toString()).articles)[0]}.md`,
      )
      .toString(),
    bodyBefore,
  );
  assert.equal(
    f.artifacts.filter((a) => a.name.startsWith("v2-pages-build-")).length,
    1,
  );
  assert.equal(f.deploymentCalls.length, 1);
  const discovery = await f.stage("capture", [
    "--definition-repo",
    f.repo,
    "--feed-url",
    f.feed(
      `<item><link>${source}</link><title>Unused discovery change</title></item>`,
    ),
  ]);
  assert.equal(discovery.code, 0, discovery.stderr);
  assert.notEqual(
    discovery.result.archive_output,
    rendered.result.archive_output,
  );
  const renewed = await f.stage("render", [
    "--definition-repo",
    f.repo,
    "--run-id",
    "5",
  ]);
  assert.equal(renewed.code, 0, renewed.stderr);
  assert.equal(renewed.result.publication_output, original.publication_output);
  f.addStage(renewed.result);
  f.current = { run_id: 72, attempt: 1 };
  f.addCurrent();
  const discoveryDuplicate = await f.pages("select", [
    "--render-run",
    "5",
    "--render-attempt",
    "1",
  ]);
  assert.equal(discoveryDuplicate.code, 0, discoveryDuplicate.stderr);
  assert.equal(discoveryDuplicate.result.outcome, "duplicate");
  assert.equal(
    discoveryDuplicate.result.deployment_identity,
    first.deployment_identity,
  );
  assert.equal(f.deploymentCalls.length, 1);
});

test("canonical body, title and publication-time edits change both identities and rebuild pages and search", async (t) => {
  const f = new PagesFixture(t);
  const original = await f.init(t);
  const first = await f.deploy();
  const source = f.source(
    "article.html",
    "<article><h1>Revised canonical title</h1><p>Newest bodies contain galaxiesentinel.</p></article>",
  );
  const captured = await f.stage("capture", [
    "--definition-repo",
    f.repo,
    "--feed-url",
    f.feed(
      `<item><link>${source}</link><pubDate>Mon, 12 Oct 2026 04:17:00 GMT</pubDate></item>`,
    ),
  ]);
  assert.equal(captured.code, 0, captured.stderr);
  const rendered = await f.stage("render", [
    "--definition-repo",
    f.repo,
    "--run-id",
    "3",
    "--advance",
    "true",
  ]);
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.notEqual(
    rendered.result.publication_output,
    original.publication_output,
  );
  f.addStage(rendered.result);
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const second = await f.deploy("2026-10-13T00:00:00Z", [
    "--render-run",
    "3",
    "--render-attempt",
    "1",
  ]);
  assert.notEqual(second.publication_identity, first.publication_identity);
  assert.notEqual(second.deployment_identity, first.deployment_identity);
  const manifest = JSON.parse(
    f.git("show", `${f.remoteTip()}:metadata.json`).toString(),
  );
  const article = Object.values(manifest.articles)[0] as any;
  assert.equal(article.canonical.published_at, "2026-10-12T04:17:00.000Z");
  const output = join(f.dir, "output-71-1");
  const html = readFileSync(
    join(output, article.canonical.publication_path, "index.html"),
    "utf8",
  );
  assert.match(html, /Revised canonical title/);
  assert.match(html, /galaxiesentinel/);
  assert.match(
    readFileSync(join(output, "index.html"), "utf8"),
    /Revised canonical title/,
  );
  assert.ok(existsSync(join(output, "pagefind/pagefind.js")));
  assert.equal(f.deploymentCalls.length, 2);
});

test("deployment-only retry retains original preparation/artifact and advances only deployment attempt; expiry requires rebuild", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const prepared = await f.prepared();
  let r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.equal(r.result.outcome, "authorized", r.stderr);
  r = await f.pages("report", [], f.pagesState); // no hosted success supplied
  assert.notEqual(r.code, 0);
  assert.equal(r.result.outcome, "failure");
  f.attempts.get("70/1").conclusion = "failure";
  f.attempts.get("70/1").status = "completed";
  f.current = { run_id: 70, attempt: 2 };
  f.addCurrent();
  r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.result.outcome, "authorized");
  assert.deepEqual(r.result.preparation, { run_id: 70, attempt: 1 });
  assert.deepEqual(r.result.deployment, { run_id: 70, attempt: 2 });
  assert.deepEqual(r.result.artifact, prepared.artifact);
  assert.equal(
    f.artifacts.filter((a) => a.name.startsWith("v2-pages-build-")).length,
    1,
  );
  f.artifacts.find((a) => a.id === prepared.artifact.id)!.expired = true;
  f.current = { run_id: 70, attempt: 3 };
  f.addCurrent();
  r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /fresh publish-only rebuild/);
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const rebuilt = await f.prepared();
  assert.notEqual(rebuilt.artifact.id, prepared.artifact.id);
});

test("presentation-only changes deploy independently; identical commit bookkeeping remains duplicate and user work is preserved", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const first = await f.deploy();
  const archive = f.remoteTip();
  f.git("commit", "--allow-empty", "-qm", "Operational bookkeeping");
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  let r = await f.pages("select");
  assert.equal(r.result.outcome, "duplicate", r.stderr);
  const css = join(f.repo, "site/src/styles/archive.css");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    css,
    readFileSync(css, "utf8") + "\nbody { color: #243045; }\n",
  );
  f.git("add", "site");
  f.git("commit", "-qm", "Presentation fix");
  f.addCurrent();
  writeFileSync(css, "user uncommitted work");
  f.git("add", "site");
  const before = f.text("status", "--porcelain");
  const deployed = await f.deploy("2026-10-13T00:00:00Z");
  assert.notEqual(deployed.deployment_identity, first.deployment_identity);
  assert.equal(deployed.publication_identity, first.publication_identity);
  assert.equal(f.remoteTip(), archive);
  assert.equal(f.text("status", "--porcelain"), before);
  assert.equal(readFileSync(css, "utf8"), "user uncommitted work");
});

test("force still requires current render and trustworthy baseline; stale preparation and final authorization are superseded", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const prep = await f.prepared(["--force"]);
  f.git("fetch", "--no-tags", "origin", prep.archive_revision);
  f.git("branch", "later-archive", prep.archive_revision);
  const newer = f.text(
    "commit-tree",
    f.text("rev-parse", `${prep.archive_revision}^{tree}`),
    "-p",
    prep.archive_revision,
    "-m",
    "Newer archive",
  );
  f.git("push", "origin", `${newer}:refs/heads/${f.branch}`);
  let r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.result.outcome, "superseded");
  assert.equal(r.result.force, true);
  r = await f.pages("select", [
    "--render-run",
    "2",
    "--render-attempt",
    "1",
    "--force",
  ]);
  assert.equal(r.result.outcome, "superseded");
  f.git(
    "push",
    "--force",
    "origin",
    `${prep.archive_revision}:refs/heads/${f.branch}`,
  ); // controlled fixture only
  f.attempts.get("2/1").head_repository.full_name = "foreign/repo";
  r = await f.pages("select", [
    "--render-run",
    "2",
    "--render-attempt",
    "1",
    "--force",
  ]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /trusted/);
  assert.equal(
    f.artifacts.filter((a) => a.name.startsWith("v2-pages-result-")).length,
    0,
  );
});

test("automatic render-only does not advance; manual selectors and successful earlier render attempt remain usable after failed rerun", async (t) => {
  const f = new PagesFixture(t);
  const render = await f.init(t, true);
  render.advance = false;
  render.eligible = false;
  const artifact = f.artifacts.find((a) => a.name === "v2-stage-render-2-1");
  f.records.set(artifact.id, render);
  f.attempts.get("70/1").event = "workflow_run";
  let r = await f.pages("select", [
    "--mode",
    "automatic",
    "--render-run",
    "2",
    "--render-attempt",
    "1",
  ]);
  assert.equal(r.result.outcome, "stage-only", r.stderr);
  f.attempts.get("70/1").event = "workflow_dispatch";
  f.attempts.set("2/2", {
    ...f.attempts.get("2/1"),
    run_attempt: 2,
    conclusion: "failure",
  });
  r = await f.pages("select");
  assert.equal(r.result.outcome, "pending", r.stderr);
  assert.deepEqual(r.result.render, { run_id: 2, attempt: 1 });
  for (const extra of [
    ["--render-run", "2"],
    ["--render-attempt", "1"],
    ["--render-run", "2", "--render-attempt", "2"],
    ["--feed-url", "https://github.blog/feed/"],
  ]) {
    r = await f.pages("select", extra);
    assert.notEqual(r.code, 0);
  }
  const prep = await f.prepared();
  assert.equal(prep.outcome, "prepared");
  assert.match(
    readFileSync(join(f.dir, "output-70-1/index.html"), "utf8"),
    /No archived|archive|Archive/,
  );
});

test("baseline uses actual deployment order including late retry of an older run and paginated unrelated successes", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  await f.deploy(undefined, ["--force"]);
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  await f.deploy("2026-10-13T00:00:00Z", ["--force"]);
  f.current = { run_id: 70, attempt: 2 };
  f.addCurrent();
  let r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.equal(r.result.outcome, "authorized", r.stderr);
  const job = f.job(
    "deploy",
    [
      "Deploy Pages",
      "Record deployment",
      "Publish deployment evidence",
      "Report evidence publication outcome",
    ],
    "2026-10-14T00:00:00Z",
  );
  f.jobs.set("70/2", [job]);
  r = await f.pages("report", [
    "--url",
    "https://fixture.invalid/site/",
    "--job-id",
    String(job.id),
  ]);
  assert.equal(r.code, 0, r.stderr);
  f.addArtifact("v2-pages-result-70-2", f.current, r.result);
  f.attempts.set("70/2", f.runMeta(f.current, "v2-pages.yml"));
  for (let id = 100; id < 202; id++)
    f.attempts.set(
      `${id}/1`,
      f.runMeta({ run_id: id, attempt: 1 }, "v2-pages.yml"),
    );
  f.current = { run_id: 300, attempt: 1 };
  f.addCurrent();
  r = await f.pages("select");
  assert.equal(r.result.outcome, "duplicate", r.stderr);
  assert.deepEqual(r.result.baseline.deployment, { run_id: 70, attempt: 2 });
  assert.ok(
    f.requests.some(
      (path) => path.includes("v2-pages.yml/runs?") && path.includes("page=2"),
    ),
  );
});

test("malformed, contradictory, unavailable or untrusted evidence never authorizes recovery or force", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const first = await f.deploy();
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const renderArtifact = f.artifacts.find(
    (a) => a.name === "v2-stage-render-2-1",
  );
  const run = f.attempts.get("2/1");
  for (const [key, value] of [
    ["head_branch", "feature"],
    ["head_sha", "a".repeat(40)],
    ["event", "pull_request"],
    ["status", "queued"],
    ["conclusion", "failure"],
    ["path", ".github/workflows/v2-capture.yml"],
  ] as const) {
    const before = run[key];
    run[key] = value;
    const r = await f.pages("select", [
      "--render-run",
      "2",
      "--render-attempt",
      "1",
      "--force",
    ]);
    assert.notEqual(r.code, 0, `${key}: ${r.stderr}`);
    run[key] = before;
  }
  for (const kind of [
    "expiry",
    "duplicate",
    "ownership",
    "unsafe",
    "oversized",
    "malformed",
  ]) {
    const original = structuredClone(renderArtifact);
    const { artifactZip } = await import("./stage-support.js");
    if (kind === "expiry") renderArtifact.expired = true;
    if (kind === "duplicate") f.artifacts.push({ ...renderArtifact });
    if (kind === "ownership")
      renderArtifact.workflow_run.head_sha = "b".repeat(40);
    if (kind === "unsafe")
      f.payloads.set(
        renderArtifact.id,
        artifactZip({ ignored: true }, "../stage.json"),
      );
    if (kind === "oversized")
      f.payloads.set(renderArtifact.id, artifactZip("x".repeat(100000)));
    if (kind === "malformed")
      f.payloads.set(renderArtifact.id, Buffer.from("not a zip"));
    const r = await f.pages("select", [
      "--render-run",
      "2",
      "--render-attempt",
      "1",
      "--reestablish",
    ]);
    assert.notEqual(r.code, 0, kind);
    Object.assign(renderArtifact, original);
    if (kind === "duplicate") f.artifacts.pop();
    f.payloads.delete(renderArtifact.id);
  }
  const resultArtifact = f.artifacts.find(
    (a) => a.name === "v2-pages-result-70-1",
  );
  const original = f.records.get(resultArtifact.id);
  for (const mutation of [
    { job_id: first.job_id + 1 },
    { deployment_identity: "e".repeat(64) },
    { url: "http://untrusted.invalid" },
    { completed_at: "2026-10-15T00:00:00Z" },
    { artifact: { ...first.artifact, id: first.artifact.id + 1 } },
  ]) {
    f.records.set(resultArtifact.id, { ...original, ...mutation });
    const r = await f.pages("select", ["--reestablish"]);
    assert.notEqual(r.code, 0);
    assert.notEqual(r.result.outcome, "pending");
  }
  f.records.set(resultArtifact.id, original);
  const index = f.artifacts.indexOf(resultArtifact);
  f.artifacts.splice(index, 1);
  let r = await f.pages("select", ["--reestablish"]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /baseline-evidence-unavailable/);
  f.artifacts.push(resultArtifact);
  f.apiStatus = 403;
  r = await f.pages("select", ["--force", "--reestablish"]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /HTTP 403/);
});

test("failed hosted result never replaces baseline; source acquisition even caught inside Astro fails the real build", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const prior = await f.deploy();
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  const prep = await f.prepared(["--force"]);
  let r = await f.pages("authorize", [
    "--preparation-run",
    "71",
    "--preparation-attempt",
    "1",
  ]);
  assert.equal(r.result.outcome, "authorized", r.stderr);
  const job = f.job(
    "deploy",
    [
      "Deploy Pages",
      "Record deployment",
      "Publish deployment evidence",
      "Report evidence publication outcome",
    ],
    "2026-10-13T00:00:00Z",
  );
  f.jobs.get("71/1")!.push(job);
  r = await f.pages("report", [
    "--url",
    "https://fixture.invalid/site/",
    "--job-id",
    String(job.id),
  ]);
  assert.equal(r.result.outcome, "deployed");
  job.steps.at(-2)!.conclusion = "failure";
  job.conclusion = "failure";
  f.attempts.set(
    "71/1",
    f.runMeta(f.current, "v2-pages.yml", "completed", "failure"),
  );
  f.addArtifact("v2-pages-result-71-1", f.current, r.result);
  f.current = { run_id: 72, attempt: 1 };
  f.addCurrent();
  r = await f.pages("select");
  assert.equal(r.result.outcome, "duplicate", r.stderr);
  assert.deepEqual(r.result.baseline.deployment, prior.deployment);
  const { writeFileSync } = await import("node:fs");
  const page = join(f.repo, "site/src/pages/index.astro");
  writeFileSync(
    page,
    readFileSync(page, "utf8").replace(
      "---",
      '---\ntry { await fetch("https://github.blog/changelog/"); } catch {}\n',
    ),
  );
  f.git("add", "site");
  f.git("commit", "-qm", "Caught acquisition positive control");
  f.addCurrent();
  r = await f.pages("select");
  assert.equal(r.result.outcome, "pending", r.stderr);
  r = await f.pages("prepare", [
    "--installed",
    "--output",
    join(f.dir, "offline-positive-control"),
  ]);
  assert.notEqual(r.code, 0);
  assert.equal(r.result.outcome, "failure");
  assert.match(
    readFileSync(join(f.dir, "pages-network.log"), "utf8"),
    /attempted network access/,
  );
  assert.equal(existsSync(join(f.dir, "offline-positive-control")), false);
  assert.equal(
    f.artifacts.filter((a) => a.name.startsWith("v2-pages-build-")).length,
    2,
  );
  assert.equal(f.remoteTip(), prep.archive_revision);
});

test("production Pages preserves shared queue, least permissions, exact attempt wiring and build execution agreement", async () => {
  const { parse } = await import("yaml");
  const { root } = await import("./support.js");
  const production = parse(
    readFileSync(join(root, ".github/workflows/v2-pages.yml"), "utf8"),
  );
  const definition = JSON.parse(
    readFileSync(join(root, ".github/v2-pages-build.json"), "utf8"),
  );
  assert.equal(production.jobs.prepare.env.ARCHIVE_BRANCH, "mirror-data-v2");
  assert.equal(production.jobs.deploy.env.ARCHIVE_BRANCH, "mirror-data-v2");
  assert.deepEqual(production.concurrency, {
    group: "copilot-archive-production",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(production.on.workflow_run.workflows, [
    "V2 production render",
  ]);
  for (const workflow of [production]) {
    assert.equal(workflow.on.schedule, undefined);
    assert.equal(workflow.on.workflow_dispatch.inputs.force.default, false);
    assert.equal(
      workflow.on.workflow_dispatch.inputs.reestablish.default,
      false,
    );
    const prepare = workflow.jobs.prepare;
    assert.deepEqual(prepare.permissions, {
      contents: "read",
      actions: "read",
    });
    assert.equal(prepare["runs-on"], definition.steps[0].runner);
    assert.equal(
      prepare.steps.find((s: any) => s.uses?.startsWith("actions/setup-node@"))
        .uses,
      definition.steps[0].setup_action,
    );
    const build = prepare.steps.find(
      (s: any) => s.name === "Build selected site",
    );
    assert.match(build.run, /pages -- prepare/);
    assert.doesNotMatch(build.run, /installed/);
    assert.match(
      prepare.steps.find(
        (s: any) => s.name === "Select exact rendered publication",
      ).run,
      /--definition-file .github\/v2-pages-build.json/,
    );
    const upload = prepare.steps.find(
      (s: any) => s.name === "Upload Pages artifact",
    );
    assert.equal(upload.with["retention-days"], 1);
    assert.match(upload.with.name, /github.run_attempt/);
    const proof = prepare.steps.find(
      (s: any) => s.name === "Publish preparation evidence",
    );
    assert.equal(proof.with["retention-days"], 90);
    assert.equal(proof.with["if-no-files-found"], "error");
    assert.equal(proof["continue-on-error"], undefined);
    assert.equal(
      prepare.steps.at(-1).name,
      "Report evidence publication outcome",
    );
    for (const step of prepare.steps)
      assert.doesNotMatch(
        step.run ?? "",
        /git push|capture|render --|gh run watch/,
      );
  }
  const deploy = production.jobs.deploy;
  assert.deepEqual(deploy.permissions, {
    contents: "read",
    actions: "read",
    pages: "write",
    "id-token": "write",
  });
  assert.equal(deploy.environment.name, "github-pages");
  assert.match(deploy.environment.url, /deployment.outputs.page_url/);
  assert.match(
    deploy.env.PREPARATION_ATTEMPT,
    /needs.prepare.outputs.preparation_attempt/,
  );
  const steps = deploy.steps;
  const authorize = steps.findIndex(
    (s: any) => s.name === "Authorize exact original Pages artifact",
  );
  assert.equal(steps[authorize + 1].name, "Deploy Pages");
  assert.match(
    steps[authorize].run,
    /--preparation-attempt "\$PREPARATION_ATTEMPT"/,
  );
  assert.match(
    steps[authorize + 1].with.artifact_name,
    /authorization.outputs.artifact_name/,
  );
  assert.equal(steps.at(-1).name, "Report evidence publication outcome");
  assert.equal(
    steps.find((s: any) => s.name === "Publish deployment evidence").with[
      "retention-days"
    ],
    90,
  );
});

test("retention recovery requires renewed render evidence and supported build, then records only a completed new success", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const prior = await f.deploy();
  const baseline = f.artifacts.find((a) => a.name === "v2-pages-result-70-1");
  baseline.expired = true;
  f.artifacts.find((a) => a.name === "v2-stage-render-2-1")!.expired = true;
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  let r = await f.pages("select", [
    "--reestablish",
    "--render-run",
    "2",
    "--render-attempt",
    "1",
  ]);
  assert.notEqual(r.code, 0);
  const renewed = await f.stage("render", [
    "--definition-repo",
    f.repo,
    "--run-id",
    "3",
  ]);
  assert.equal(renewed.code, 0, renewed.stderr);
  f.addStage(renewed.result);
  r = await f.pages("select", ["--reestablish"]);
  assert.equal(r.result.outcome, "pending", r.stderr);
  assert.deepEqual(r.result.render, { run_id: 3, attempt: 1 });
  const { writeFileSync } = await import("node:fs");
  const path = join(f.repo, ".github/v2-pages-build.json");
  const original = readFileSync(path, "utf8");
  const definition = JSON.parse(original);
  definition.steps.push({ kind: "unrecorded", command: ["echo", "invalid"] });
  writeFileSync(path, JSON.stringify(definition));
  f.git("add", ".github");
  f.git("commit", "-qm", "Unsupported definition");
  f.addCurrent();
  r = await f.pages("select", ["--reestablish"]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /Unsupported build definition/);
  writeFileSync(path, original);
  f.git("add", ".github");
  f.git("commit", "-qm", "Restore supported definition");
  f.addCurrent();
  r = await f.pages("select", ["--reestablish"]);
  assert.equal(r.result.outcome, "pending", r.stderr);
  r = await f.pages("prepare", [
    "--installed",
    "--output",
    join(f.repo, "user-output"),
  ]);
  assert.notEqual(r.code, 0);
  assert.equal(r.result.outcome, "failure");
  assert.deepEqual(r.result.recovery_candidate.deployment, prior.deployment);
  assert.equal(
    f.artifacts.filter((a) => a.name.startsWith("v2-pages-result-")).length,
    1,
  );
});

test("caller state/output cannot overwrite application work through direct paths or symlink parents", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const before = readFileSync(join(f.repo, "app.txt"), "utf8");
  let r = await f.pages("select", [], join(f.repo, "app.txt"));
  assert.notEqual(r.code, 0);
  assert.equal(readFileSync(join(f.repo, "app.txt"), "utf8"), before);
  const { symlinkSync } = await import("node:fs");
  const link = join(f.dir, "user-work");
  symlinkSync(f.repo, link);
  r = await f.pages("select");
  assert.equal(r.result.outcome, "pending", r.stderr);
  r = await f.pages("prepare", [
    "--installed",
    "--output",
    join(link, "output"),
  ]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /outside application/);
  assert.equal(existsSync(join(f.repo, "output")), false);
});

test("current-render resolution ignores unavailable unrelated attempts but never falls back for explicit selectors or API failures", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  f.attempts.set(
    "20/1",
    f.runMeta({ run_id: 20, attempt: 1 }, "v2-render.yml"),
  );
  const artifact = f.addArtifact("v2-stage-render-20-1", {
    run_id: 20,
    attempt: 1,
  });
  f.artifacts.find((a) => a.id === artifact)!.expired = true;
  let r = await f.pages("select");
  assert.equal(r.result.outcome, "pending", r.stderr);
  assert.deepEqual(r.result.render, { run_id: 2, attempt: 1 });
  r = await f.pages("select", ["--render-run", "20", "--render-attempt", "1"]);
  assert.notEqual(r.code, 0);
  f.apiStatus = 503;
  r = await f.pages("select");
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /HTTP 503/);
});

test("a final-component state symlink cannot overwrite user files", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const { symlinkSync } = await import("node:fs");
  const state = join(f.dir, "linked-state");
  symlinkSync(join(f.repo, "app.txt"), state);
  const before = readFileSync(join(f.repo, "app.txt"), "utf8");
  const r = await f.pages("select", [], state);
  assert.notEqual(r.code, 0);
  assert.equal(readFileSync(join(f.repo, "app.txt"), "utf8"), before);
});

test("expired preparation or result does not qualify retention recovery when available preparation job evidence contradicts success", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  await f.deploy();
  f.current = { run_id: 71, attempt: 1 };
  f.addCurrent();
  f.artifacts.find((a) => a.name === "v2-pages-preparation-70-1")!.expired =
    true;
  const prepare = f.jobs.get("70/1")!.find((job) => job.name === "prepare");
  prepare.conclusion = "failure";
  let r = await f.pages("select", ["--reestablish"]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /Unsuccessful prepare job/);
  f.artifacts.find((a) => a.name === "v2-pages-result-70-1")!.expired = true;
  r = await f.pages("select", ["--reestablish"]);
  assert.notEqual(r.code, 0);
  assert.match(r.result.diagnostic, /Unsuccessful prepare job/);
});

test("the final freshness check supersedes movement during last artifact lookup even with force and calls no deployment", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  const prep = await f.prepared(["--force"]);
  let requests = 0;
  f.onRequest = (path) => {
    if (!path.includes("/actions/runs/70/artifacts?") || ++requests !== 3)
      return;
    const newer = f.text(
      "commit-tree",
      f.text("rev-parse", `${prep.archive_revision}^{tree}`),
      "-p",
      prep.archive_revision,
      "-m",
      "Moved during final artifact lookup",
    );
    f.git("push", "origin", `${newer}:refs/heads/${f.branch}`);
  };
  const output = join(f.dir, "authorization-outputs");
  const r = await f.pages(
    "authorize",
    ["--preparation-run", "70", "--preparation-attempt", "1"],
    f.pagesState,
    { GITHUB_OUTPUT: output },
  );
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.result.outcome, "superseded");
  assert.equal(r.result.force, true);
  assert.match(readFileSync(output, "utf8"), /^deploy=false$/m);
  assert.equal(f.hostedDeployment(r.result), false);
  assert.equal(f.deploymentCalls.length, 0);
});

test("a failed final archive lookup is a failure rather than supersession or permission to deploy", async (t) => {
  const f = new PagesFixture(t);
  await f.init(t);
  await f.prepared(["--force"]);
  let requests = 0;
  f.onRequest = (path) => {
    if (path.includes("/actions/runs/70/artifacts?") && ++requests === 3)
      f.git("remote", "set-url", "origin", join(f.dir, "missing-remote.git"));
  };
  const r = await f.pages("authorize", [
    "--preparation-run",
    "70",
    "--preparation-attempt",
    "1",
  ]);
  assert.notEqual(r.code, 0);
  assert.equal(r.result.outcome, "failure");
  assert.match(r.result.diagnostic, /Git ls-remote failed/);
  assert.equal(f.hostedDeployment(r.result), false);
  assert.equal(f.deploymentCalls.length, 0);
});
