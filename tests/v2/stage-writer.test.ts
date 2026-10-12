import assert from "node:assert/strict";
import { test } from "node:test";
import { StageFixture } from "./stage-support.js";

test("capture persists raw input before manual offline rendering, and unchanged stages renew durable evidence", async (t) => {
  const f = new StageFixture(t);
  const source = f.source(
    "article.html",
    "<article><h1>Editorial title</h1><p>Saved body.</p></article>",
  );
  const feed = f.feed(`<item><link>${source}</link></item>`);
  const capture = await f.stage("capture", ["--feed-url", feed]);
  assert.equal(capture.code, 0, capture.stderr);
  assert.equal(capture.result.version, 2);
  assert.equal(capture.result.outcome, "changed");
  assert.equal(capture.result.eligible, true);
  assert.equal(capture.result.archive_output, f.remoteTip());
  const input = f.remoteTip();
  const same = await f.stage("capture", ["--feed-url", feed]);
  assert.equal(same.result.outcome, "no-change");
  assert.equal(same.result.archive_output, input);
  assert.equal(same.result.eligible, true);
  const render = await f.stage("render");
  assert.equal(render.code, 0, render.stderr);
  assert.equal(render.result.archive_input, input);
  assert.equal(render.result.archive_output, f.remoteTip());
  assert.equal(render.result.publication_outcome, "initialized");
  assert.match(render.result.publication_output, /^[a-f0-9]{64}$/);
  assert.equal(render.result.eligible, false);
  assert.equal(f.text("rev-parse", `${f.remoteTip()}^`), input);
  const again = await f.stage("render", ["--advance", "true"]);
  assert.equal(again.code, 0, again.stderr);
  assert.equal(again.result.outcome, "no-change");
  assert.equal(again.result.publication_outcome, "no-change");
  assert.equal(
    again.result.publication_output,
    render.result.publication_output,
  );
  assert.equal(again.result.eligible, true);
  assert.equal(f.text("rev-parse", "HEAD"), capture.result.application_sha);
});

test("push rejection never claims persistence, and a new manual render recovers saved capture", async (t) => {
  const { writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const f = new StageFixture(t);
  const source = f.source(
    "article.html",
    "<article><h1>Saved title</h1><p>Saved body.</p></article>",
  );
  const capture = await f.stage("capture", [
    "--feed-url",
    f.feed(`<item><link>${source}</link></item>`),
    "--advance",
    "false",
  ]);
  assert.equal(capture.result.eligible, false);
  const hook = join(f.remote, "hooks/pre-receive");
  writeFileSync(hook, "#!/bin/sh\necho 'fixture refuses push' >&2\nexit 1\n", {
    mode: 0o755,
  });
  const failed = await f.stage("render", ["--advance", "true"]);
  assert.notEqual(failed.code, 0);
  assert.equal(failed.result.outcome, "failure");
  assert.equal(failed.result.eligible, false);
  assert.equal(failed.result.archive_output, null);
  assert.equal(failed.result.persisted_revision, null);
  assert.match(failed.result.candidate_revision, /^[a-f0-9]{40}$/);
  assert.equal(f.remoteTip(), capture.result.archive_output);
  rmSync(hook);
  const recovered = await f.stage("render");
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(recovered.result.archive_input, capture.result.archive_output);
});

test("fresh bootstrap push and acquisition failures remain visible without remote evidence", async (t) => {
  const { writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const f = new StageFixture(t);
  const missing = await f.stage("capture", [
    "--feed-url",
    "file:///does-not-exist.xml",
  ]);
  assert.notEqual(missing.code, 0);
  assert.equal(missing.result.archive_output, null);
  assert.equal(f.remoteTip(), null);
  const hook = join(f.remote, "hooks/pre-receive");
  writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const denied = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.notEqual(denied.code, 0);
  assert.equal(denied.result.eligible, false);
  assert.equal(denied.result.archive_output, null);
  assert.equal(f.remoteTip(), null);
  rmSync(hook);
  const ok = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(ok.code, 0, ok.stderr);
  const render = await f.stage("render");
  assert.equal(render.code, 0, render.stderr);
  assert.equal(render.result.outcome, "no-change");
  assert.match(render.result.publication_output, /^[a-f0-9]{64}$/);
});

test("operational writers preserve dirty application state and refuse conflicting user archive refs", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const f = new StageFixture(t);
  writeFileSync(`${f.repo}/app.txt`, "staged\n");
  f.git("add", "app.txt");
  writeFileSync(`${f.repo}/app.txt`, "unstaged\n");
  writeFileSync(`${f.repo}/user.txt`, "untracked\n");
  const status = f.git("status", "--porcelain"),
    index = f.git("diff", "--cached"),
    work = f.git("diff");
  const capture = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(capture.code, 0, capture.stderr);
  assert.deepEqual(f.git("status", "--porcelain"), status);
  assert.deepEqual(f.git("diff", "--cached"), index);
  assert.deepEqual(f.git("diff"), work);
  f.git("branch", f.branch, "HEAD");
  const failed = await f.stage("render");
  assert.notEqual(failed.code, 0);
  assert.match(failed.result.diagnostic, /User-owned/);
  assert.equal(f.text("rev-parse", f.branch), f.text("rev-parse", "HEAD"));
  assert.equal(f.remoteTip(), capture.result.archive_output);
});

test("raw chrome and unused discovery changes persist without changing canonical publication identity", async (t) => {
  const f = new StageFixture(t);
  const html = (chrome: string, body = "Saved body.") =>
    `<nav>${chrome}</nav><article><h1>Saved title</h1><p>${body}</p></article>`;
  const source = f.source("article.html", html("chrome 1"));
  const feed = f.feed(
    `<item><title>Discovery 1</title><link>${source}</link></item>`,
  );
  await f.stage("capture", ["--feed-url", feed]);
  const first = await f.stage("render");
  f.source("article.html", html("chrome 2"));
  f.feed(`<item><title>Discovery 2</title><link>${source}</link></item>`);
  const raw = await f.stage("capture", ["--feed-url", feed]);
  assert.equal(raw.result.outcome, "changed");
  const same = await f.stage("render");
  assert.equal(same.result.outcome, "no-change");
  assert.equal(same.result.publication_output, first.result.publication_output);
  assert.equal(same.result.publication_outcome, "no-change");
  f.source("article.html", html("chrome 2", "Changed body."));
  await f.stage("capture", ["--feed-url", feed]);
  const changed = await f.stage("render");
  assert.equal(changed.result.publication_outcome, "changed");
  assert.notEqual(
    changed.result.publication_output,
    first.result.publication_output,
  );
});

test("render rejects capture options and legacy targets remain protected before cutover", async (t) => {
  const f = new StageFixture(t);
  const rejected = await f.stage("render", ["--feed-url", f.feed("")]);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.result.diagnostic, /capture options/);
  f.git("branch", "mirror-data", "HEAD");
  f.git("push", "origin", "mirror-data");
  const legacy = f.remoteTip("mirror-data");
  const protectedRun = await f.stage("capture", [
    "--archive-branch",
    "mirror-data",
    "--feed-url",
    f.feed(""),
  ]);
  assert.notEqual(protectedRun.code, 0);
  assert.match(protectedRun.result.diagnostic, /#24 cutover/);
  assert.equal(f.remoteTip("mirror-data"), legacy);
  f.git("push", "origin", `HEAD:refs/heads/${f.branch}`);
  const notMigrated = await f.stage("render");
  assert.notEqual(notMigrated.code, 0);
  assert.match(notMigrated.result.diagnostic, /legacy.*cutover/);
});

test("evidence reporting failure after persistence fails the attempt and a fresh unchanged stage repairs evidence", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const f = new StageFixture(t);
  const first = await f.stage("capture", ["--feed-url", f.feed("")], {
    GITHUB_OUTPUT: f.dir,
  });
  assert.notEqual(first.code, 0);
  assert.equal(first.result.outcome, "failure");
  assert.equal(first.result.eligible, false);
  assert.equal(first.result.archive_output, null);
  assert.equal(first.result.persisted_revision, f.remoteTip());
  const repaired = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(repaired.code, 0, repaired.stderr);
  assert.equal(repaired.result.outcome, "no-change");
  assert.equal(repaired.result.eligible, true);
  const state = JSON.parse(
    (await import("node:fs")).readFileSync(f.state, "utf8"),
  );
  assert.equal(state.archive_output, f.remoteTip());
  writeFileSync(f.state, JSON.stringify(state));
  const report = await f.stage("report", [], { STAGE_STATUS: "failure" });
  assert.notEqual(report.code, 0);
  assert.equal(report.result.archive_output, null);
  assert.equal(report.result.persisted_revision, f.remoteTip());
});

test("failed derivation leaves capture durable and missing canonical bodies are repaired from saved evidence", async (t) => {
  const f = new StageFixture(t);
  const source = f.source("article.html", "<nav>No editorial content</nav>");
  const feed = f.feed(`<item><link>${source}</link></item>`);
  const raw = await f.stage("capture", ["--feed-url", feed]);
  const failed = await f.stage("render", ["--advance", "true"]);
  assert.notEqual(failed.code, 0);
  assert.equal(failed.result.eligible, false);
  assert.equal(f.remoteTip(), raw.result.archive_output);
  f.source(
    "article.html",
    "<article><h1>Saved title</h1><p>Saved body.</p></article>",
  );
  await f.stage("capture", ["--feed-url", feed]);
  const rendered = await f.stage("render");
  assert.equal(rendered.code, 0, rendered.stderr);
  f.git("branch", f.branch, rendered.result.archive_output);
  const id = Object.keys(f.manifest().articles)[0]!;
  f.seed({}, {}, [`posts/${id}.md`]);
  f.git("push", "-q", "origin", f.branch);
  const broken = f.remoteTip();
  const repaired = await f.stage("render");
  assert.equal(repaired.code, 0, repaired.stderr);
  assert.equal(repaired.result.archive_input, broken);
  assert.equal(repaired.result.publication_outcome, "initialized");
  assert.equal(
    repaired.result.publication_output,
    rendered.result.publication_output,
  );
  assert.equal(
    f.git("show", `${f.remoteTip()}:posts/${id}.md`).toString(),
    "Saved body.\n",
  );
});

test("executed application source matches the recorded commit while dirty source remains intact", async (t) => {
  const { writeFileSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const f = new StageFixture(t);
  const dirty = join(f.repo, "src/v2/cli.ts");
  const bytes =
    "throw new Error('Uncommitted application must not execute');\n";
  writeFileSync(dirty, bytes);
  const run = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.result.application_sha, f.text("rev-parse", "HEAD"));
  assert.equal(run.result.archive_output, f.remoteTip());
  assert.equal(readFileSync(dirty, "utf8"), bytes);
});

test("modified workflow tool source cannot be advertised under a committed definition SHA", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const f = new StageFixture(t);
  writeFileSync(
    `${f.repo}/src/v2/stage-offline.ts`,
    "throw new Error('uncommitted guard');\n",
  );
  const run = await f.stage("capture", [
    "--definition-repo",
    f.repo,
    "--feed-url",
    f.feed(""),
  ]);
  assert.notEqual(run.code, 0);
  assert.equal(run.result.eligible, false);
  assert.match(run.result.diagnostic, /recorded definition revision/);
  assert.equal(f.remoteTip(), null);
});
