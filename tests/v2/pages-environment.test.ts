import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PagesFixture } from "./pages-support.js";

test("Pages and stage fixtures isolate ambient Actions context while explicit event validation remains enforced", async (t) => {
  const f = new PagesFixture(t);
  const runnerEvent = join(f.dir, "runner-event.json");
  const runnerOutput = join(f.dir, "runner-output");
  const runnerSummary = join(f.dir, "runner-summary");
  writeFileSync(
    runnerEvent,
    JSON.stringify({
      repository: { full_name: "runner/foreign", default_branch: "main" },
    }),
  );
  writeFileSync(runnerOutput, "runner output sentinel\n");
  writeFileSync(runnerSummary, "runner summary sentinel\n");
  const ambient = {
    GITHUB_EVENT_PATH: runnerEvent,
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "runner/foreign",
    GITHUB_REF: "refs/pull/30/merge",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_RUN_ID: "9999",
    GITHUB_RUN_ATTEMPT: "9",
    GITHUB_API_URL: "http://127.0.0.1:1",
    GITHUB_OUTPUT: runnerOutput,
    GITHUB_STEP_SUMMARY: runnerSummary,
    GH_TOKEN: "ambient-runner-token",
    GITHUB_TOKEN: "ambient-runner-token",
    PAGES_STATUS: "failure",
    STAGE_STATUS: "failure",
  };
  const previous = new Map(
    Object.keys(ambient).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, ambient);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const render = await f.init(t);
  let result = await f.pages("select");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.outcome, "pending");
  result = await f.pages("report");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.outcome, "pending");
  const stage = await f.stage("report");
  assert.equal(stage.code, 0, stage.stderr);
  assert.equal(stage.result.outcome, "changed");
  assert.equal(readFileSync(runnerOutput, "utf8"), "runner output sentinel\n");
  assert.equal(
    readFileSync(runnerSummary, "utf8"),
    "runner summary sentinel\n",
  );

  const controlledEvent = join(f.dir, "controlled-event.json");
  const controlledOutput = join(f.dir, "controlled-output");
  const controlledSummary = join(f.dir, "controlled-summary");
  const controlled: NodeJS.ProcessEnv = {
    GITHUB_EVENT_PATH: controlledEvent,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "fixture/archive",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: f.text("rev-parse", "HEAD"),
    GITHUB_RUN_ID: String(f.current.run_id),
    GITHUB_RUN_ATTEMPT: String(f.current.attempt),
    GITHUB_OUTPUT: controlledOutput,
    GITHUB_STEP_SUMMARY: controlledSummary,
  };
  const repository = { full_name: "fixture/archive", default_branch: "main" };
  writeFileSync(controlledEvent, JSON.stringify({ repository, inputs: {} }));
  result = await f.pages("select", [], f.pagesState, controlled);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.mode, "manual");
  assert.match(readFileSync(controlledOutput, "utf8"), /^proceed=true$/m);
  assert.match(readFileSync(controlledSummary, "utf8"), /v2 Pages: pending/);

  f.attempts.get("70/1").event = "workflow_run";
  controlled.GITHUB_EVENT_NAME = "workflow_run";
  writeFileSync(
    controlledEvent,
    JSON.stringify({
      repository,
      workflow_run: {
        id: render.run_id,
        run_attempt: render.attempt,
        head_sha: render.definition_sha,
        head_branch: "main",
        status: "completed",
        conclusion: "success",
        repository,
        head_repository: repository,
      },
    }),
  );
  result = await f.pages("select", [], f.pagesState, controlled);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.mode, "automatic");
  assert.deepEqual(result.result.render, {
    run_id: render.run_id,
    attempt: render.attempt,
  });
  result = await f.pages("select", [], f.pagesState, {
    ...controlled,
    GITHUB_REPOSITORY: "foreign/repository",
  });
  assert.notEqual(result.code, 0);
  assert.match(
    result.result.diagnostic,
    /Actions event contradicts trusted repository/,
  );
  result = await f.stage("report", [], { STAGE_STATUS: "failure" });
  assert.notEqual(result.code, 0);
  assert.equal(result.result.outcome, "failure");
  result = await f.pages("report", [], f.pagesState, {
    PAGES_STATUS: "failure",
  });
  assert.notEqual(result.code, 0);
  assert.equal(result.result.outcome, "failure");
  assert.equal(readFileSync(runnerOutput, "utf8"), "runner output sentinel\n");
  assert.equal(
    readFileSync(runnerSummary, "utf8"),
    "runner summary sentinel\n",
  );
});
