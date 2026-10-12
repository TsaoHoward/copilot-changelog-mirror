import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { StageFixture, evidenceServer } from "./stage-support.js";
import { root } from "./support.js";

function eventEnv(
  f: StageFixture,
  eventName: string,
  event: any,
  extra: NodeJS.ProcessEnv = {},
) {
  const path = join(f.dir, "event.json");
  writeFileSync(
    path,
    JSON.stringify({
      repository: { full_name: "fixture/archive", default_branch: "main" },
      ...event,
    }),
  );
  return {
    GITHUB_EVENT_PATH: path,
    GITHUB_REPOSITORY: "fixture/archive",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: f.text("rev-parse", "HEAD"),
    GITHUB_RUN_ID: "70",
    GITHUB_RUN_ATTEMPT: "3",
    GITHUB_EVENT_NAME: eventName,
    ...extra,
  };
}

test("Actions selection preserves schedule/manual defaults, exact attempts and distinct application/definition revisions", async (t) => {
  const f = new StageFixture(t);
  for (const [stage, event, inputs, advance] of [
    ["capture", "schedule", {}, true],
    ["capture", "workflow_dispatch", {}, true],
    ["capture", "workflow_dispatch", { advance: false }, false],
    ["render", "workflow_dispatch", {}, false],
    ["render", "workflow_dispatch", { advance: "true" }, true],
  ] as const) {
    const selected = await f.stage(
      "select",
      ["--stage", stage],
      eventEnv(f, event, { inputs }),
    );
    assert.equal(selected.code, 0, selected.stderr);
    assert.equal(selected.result.advance, advance);
    assert.equal(selected.result.run_id, 70);
    assert.equal(selected.result.attempt, 3);
    assert.equal(selected.result.definition_sha, f.text("rev-parse", "HEAD"));
  }
  const source = f.source(
    "article.html",
    "<article><p>Saved body.</p></article>",
  );
  const capture = await f.stage("capture", [
    "--feed-url",
    f.feed(`<item><link>${source}</link></item>`),
  ]);
  capture.result.definition_sha = capture.result.application_sha;
  f.git("commit", "--allow-empty", "-qm", "New workflow definition");
  const api = await evidenceServer(t, capture.result);
  const selected = await f.stage(
    "select",
    ["--stage", "render"],
    eventEnv(
      f,
      "workflow_run",
      {
        workflow_run: {
          id: 1,
          run_attempt: 1,
          head_sha: capture.result.definition_sha,
        },
      },
      { GITHUB_API_URL: api.url },
    ),
  );
  assert.equal(selected.code, 0, selected.stderr);
  assert.equal(selected.result.definition_sha, f.text("rev-parse", "HEAD"));
  assert.equal(selected.result.application_sha, capture.result.application_sha);
  assert.notEqual(
    selected.result.application_sha,
    selected.result.definition_sha,
  );
  const mismatch = await f.stage("write");
  assert.notEqual(mismatch.code, 0);
  assert.match(mismatch.result.diagnostic, /Application checkout/);
  assert.equal(f.remoteTip(), capture.result.archive_output);
});

test("Actions guards reject foreign/default-branch/event contradictions before archive writes", async (t) => {
  const f = new StageFixture(t);
  for (const [name, event, env] of [
    [
      "foreign repository",
      { repository: { full_name: "foreign/repo", default_branch: "main" } },
      {},
    ],
    [
      "different default",
      { repository: { full_name: "fixture/archive", default_branch: "other" } },
      {},
    ],
    ["wrong ref", {}, { GITHUB_REF: "refs/heads/feature" }],
    ["definition mismatch", {}, { GITHUB_SHA: "a".repeat(40) }],
    ["pull request", {}, { GITHUB_EVENT_NAME: "pull_request" }],
    ["invalid input", { inputs: { advance: "maybe" } }, {}],
  ] as const) {
    const selected = await f.stage(
      "select",
      ["--stage", "capture"],
      eventEnv(f, "workflow_dispatch", event, env),
    );
    assert.notEqual(selected.code, 0, name);
    assert.equal(selected.result.eligible, false);
    assert.equal(f.remoteTip(), null);
  }
});

test("production workflows share the queue, target, schedule and exact v2 completion chain", () => {
  const capture = parse(
    readFileSync(join(root, ".github/workflows/v2-capture.yml"), "utf8"),
  );
  const render = parse(
    readFileSync(join(root, ".github/workflows/v2-render.yml"), "utf8"),
  );
  const pages = parse(
    readFileSync(join(root, ".github/workflows/v2-pages.yml"), "utf8"),
  );
  assert.deepEqual(capture.on.schedule, [
    { cron: "17 6,12 * * *", timezone: "Asia/Taipei" },
  ]);
  assert.deepEqual(pages.concurrency, {
    group: "copilot-archive-production",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.equal(render.on.schedule, undefined);
  assert.equal(capture.on.workflow_dispatch.inputs.advance.default, true);
  assert.equal(render.on.workflow_dispatch.inputs.advance.default, false);
  assert.deepEqual(render.on.workflow_run.workflows, [capture.name]);
  assert.deepEqual(pages.on.workflow_run.workflows, [render.name]);
  assert.deepEqual(readdirSync(join(root, ".github/workflows")).sort(), [
    "ci.yml",
    "v2-capture.yml",
    "v2-pages.yml",
    "v2-render.yml",
  ]);
  const ci = parse(
    readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"),
  );
  assert.deepEqual(Object.keys(ci.jobs), ["typescript"]);
  const commands = ci.jobs.typescript.steps
    .map((s: any) => s.run)
    .filter(Boolean);
  for (const command of [
    "npm ci",
    "npm run format:check",
    "npm run typecheck",
    "npm test",
    "npm run test:browser",
  ])
    assert.ok(commands.includes(command));
  for (const [stage, workflow] of [
    ["capture", capture],
    ["render", render],
  ] as const) {
    assert.deepEqual(workflow.concurrency, {
      group: "copilot-archive-production",
      "cancel-in-progress": false,
      queue: "max",
    });
    const job = workflow.jobs[stage];
    assert.match(job.if, /default_branch/);
    assert.equal(job.env.ARCHIVE_BRANCH, "mirror-data-v2");
    assert.deepEqual(job.permissions, { contents: "write", actions: "read" });
    const upload = job.steps.find((step: any) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    assert.equal(
      upload.with.name,
      `v2-stage-${stage}-` + "${{ github.run_id }}-${{ github.run_attempt }}",
    );
    assert.equal(upload.with["retention-days"], 90);
    assert.equal(upload.with["if-no-files-found"], "error");
    assert.equal(upload["continue-on-error"], undefined);
    assert.ok(job.steps.at(-1).run.includes("report"));
    assert.ok(
      job.steps.some((step: any) => step.run?.includes("stage -- write")),
    );
    for (const step of job.steps)
      assert.doesNotMatch(
        step.run ?? "",
        /gh run (watch|download)|production_stage\.py|git push|commit-tree|sha256|metadata\.json/,
      );
  }
});

test("the shipped offline guard records and rejects even caught source acquisition attempts", (t) => {
  const f = new StageFixture(t);
  for (const expression of [
    "fetch('https://github.blog')",
    "require('node:http').get('http://example.test')",
    "require('node:https').get('https://example.test')",
    "require('node:net').connect(443,'example.test')",
  ]) {
    const log = join(f.dir, "positive-control.log");
    writeFileSync(log, "");
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--import",
          join(root, "src/v2/stage-offline.ts"),
          "-e",
          `try { ${expression}; } catch {}`,
        ],
        {
          env: { ...process.env, COPILOT_NETWORK_LOG: log },
          stdio: "pipe",
          cwd: root,
        },
      ),
    );
    assert.match(readFileSync(log, "utf8"), /attempted network access/);
  }
});
