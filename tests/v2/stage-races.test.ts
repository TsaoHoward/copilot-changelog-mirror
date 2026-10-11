import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { StageFixture, evidenceServer } from "./stage-support.js";
import { serve } from "./support.js";

function competitor(f: StageFixture, input: string) {
  const tree = f.text("rev-parse", `${input}^{tree}`);
  return f.text(
    "commit-tree",
    tree,
    "-p",
    input,
    "-m",
    "Concurrent persisted archive",
  );
}

test("remote movement during acquisition supersedes the candidate before any push", async (t) => {
  const f = new StageFixture(t);
  const first = await f.stage("capture", ["--feed-url", f.feed("")]);
  const newer = competitor(f, first.result.archive_output);
  const http = await serve(t, (_req, res) => {
    f.git("push", "-q", "origin", `${newer}:refs/heads/${f.branch}`);
    res.end("<rss><channel></channel></rss>");
  });
  const run = await f.stage("capture", ["--feed-url", http]);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.result.outcome, "superseded");
  assert.equal(run.result.eligible, false);
  assert.equal(run.result.archive_output, null);
  assert.equal(f.remoteTip(), newer);
});

test("a manual selected input is superseded before derivation when the remote changes", async (t) => {
  const f = new StageFixture(t);
  const input = (await f.stage("capture", ["--feed-url", f.feed("")])).result
    .archive_output;
  const event = join(f.dir, "event.json");
  writeFileSync(
    event,
    JSON.stringify({
      repository: { full_name: "fixture/archive", default_branch: "main" },
    }),
  );
  const selected = await f.stage("select", ["--stage", "render"], {
    GITHUB_EVENT_PATH: event,
    GITHUB_REPOSITORY: "fixture/archive",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: f.text("rev-parse", "HEAD"),
    GITHUB_RUN_ID: "80",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_EVENT_NAME: "workflow_dispatch",
  });
  assert.equal(selected.code, 0, selected.stderr);
  const newer = competitor(f, input);
  f.git("push", "-q", "origin", `${newer}:refs/heads/${f.branch}`);
  const run = await f.stage("write", ["--definition-repo", f.repo]);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.result.outcome, "superseded");
  assert.equal(run.result.candidate_revision, null);
  assert.equal(f.remoteTip(), newer);
});

test("a competitor moving the archive immediately after push prevents eligible output", async (t) => {
  const f = new StageFixture(t);
  const hook = join(f.remote, "hooks/post-receive");
  writeFileSync(
    hook,
    `#!/bin/sh\nwhile read old new ref; do\n  tree=$(git rev-parse "$new^{tree}")\n  next=$(git -c user.name=Competitor -c user.email=competitor@example.invalid commit-tree "$tree" -p "$new" -m 'Concurrent writer')\n  git update-ref "$ref" "$next" "$new"\ndone\n`,
    { mode: 0o755 },
  );
  const run = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.result.outcome, "superseded");
  assert.equal(run.result.archive_output, null);
  assert.equal(run.result.eligible, false);
  assert.notEqual(f.remoteTip(), run.result.candidate_revision);
  f.git("fetch", "--no-write-fetch-head", "origin", f.remoteTip()!);
  assert.equal(
    f.text("rev-parse", `${f.remoteTip()}^`),
    run.result.candidate_revision,
  );
});

test("a race at ordinary push is visible as rejection and preserves the competitor", async (t) => {
  const f = new StageFixture(t);
  const input = (await f.stage("capture", ["--feed-url", f.feed("")])).result
    .archive_output;
  const newer = competitor(f, input);
  const realGit = execFileSync("which", ["git"]).toString().trim();
  const bin = join(f.dir, "bin");
  mkdirSync(bin);
  // At the Git transport boundary, advance after the final read but before push.
  writeFileSync(
    join(bin, "git"),
    `#!/bin/bash\nif [[ "$*" == *" push "* ]]; then\n  "${realGit}" -C "${f.repo}" push -q origin "${newer}:refs/heads/${f.branch}"\nfi\nexec "${realGit}" "$@"\n`,
    { mode: 0o755 },
  );
  const source = f.source(
    "article.html",
    "<article><p>New raw evidence.</p></article>",
  );
  const result = await f.stage(
    "capture",
    ["--feed-url", f.feed(`<item><link>${source}</link></item>`)],
    { PATH: `${bin}:${process.env.PATH}` },
  );
  assert.notEqual(result.code, 0);
  assert.equal(result.result.outcome, "failure");
  assert.equal(result.result.eligible, false);
  assert.equal(result.result.archive_output, null);
  assert.equal(f.remoteTip(), newer);
});

test("the exact successful old attempt remains usable after a later failed rerun", async (t) => {
  const f = new StageFixture(t);
  const capture = await f.stage("capture", ["--feed-url", f.feed("")]);
  capture.result.definition_sha = capture.result.application_sha;
  const api = await evidenceServer(t, capture.result);
  // The server fixture exposes only attempt 1; any latest/run-wide lookup fails.
  const rendered = await f.stage(
    "render",
    ["--upstream-run", "1", "--upstream-attempt", "1"],
    { GITHUB_API_URL: api.url },
  );
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(rendered.result.eligible, true);
  assert.ok(
    api.requests.every(
      (path) => !/^\/repos\/fixture\/archive\/actions\/runs\/1$/.test(path),
    ),
  );
});

test("an explicitly selected absent archive is superseded if another writer bootstraps it", async (t) => {
  const f = new StageFixture(t);
  const event = join(f.dir, "event.json"),
    selectedState = join(f.dir, "selected.json");
  writeFileSync(
    event,
    JSON.stringify({
      repository: { full_name: "fixture/archive", default_branch: "main" },
    }),
  );
  const selected = await f.stage(
    "select",
    ["--stage", "capture", "--state", selectedState],
    {
      GITHUB_EVENT_PATH: event,
      GITHUB_REPOSITORY: "fixture/archive",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: f.text("rev-parse", "HEAD"),
      GITHUB_RUN_ID: "90",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_EVENT_NAME: "workflow_dispatch",
    },
  );
  assert.equal(selected.code, 0, selected.stderr);
  assert.equal(selected.result.archive_input, null);
  const bootstrap = await f.stage("capture", ["--feed-url", f.feed("")]);
  assert.equal(bootstrap.code, 0, bootstrap.stderr);
  const old = await f.stage("write", [
    "--state",
    selectedState,
    "--definition-repo",
    f.repo,
    "--feed-url",
    f.feed(""),
  ]);
  assert.equal(old.code, 0, old.stderr);
  assert.equal(old.result.outcome, "superseded");
  assert.equal(old.result.archive_input, null);
  assert.equal(old.result.eligible, false);
  assert.equal(old.result.candidate_revision, null);
  assert.equal(f.remoteTip(), bootstrap.result.archive_output);
});
