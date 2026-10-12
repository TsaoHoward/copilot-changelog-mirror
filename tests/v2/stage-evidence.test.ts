import assert from "node:assert/strict";
import { test } from "node:test";
import { StageFixture, evidenceServer } from "./stage-support.js";

test("automatic render consumes only the trusted exact capture attempt, including unchanged recovery", async (t) => {
  const f = new StageFixture(t);
  const source = f.source(
    "article.html",
    "<article><h1>Saved title</h1><p>Saved body.</p></article>",
  );
  const capture = await f.stage("capture", [
    "--feed-url",
    f.feed(`<item><link>${source}</link></item>`),
  ]);
  // Simulate application and definition equal in the upstream manual run.
  capture.result.definition_sha = capture.result.application_sha;
  const api = await evidenceServer(t, capture.result);
  const rendered = await f.stage(
    "render",
    ["--upstream-run", "1", "--upstream-attempt", "1"],
    { GITHUB_API_URL: api.url },
  );
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(rendered.result.eligible, true);
  assert.deepEqual(rendered.result.upstream, { run_id: 1, attempt: 1 });
  assert.equal(rendered.result.archive_input, capture.result.archive_output);
  assert.equal(rendered.result.application_sha, capture.result.application_sha);
  assert.ok(
    api.requests.includes("/repos/fixture/archive/actions/runs/1/attempts/1"),
  );
  assert.ok(!api.requests.some((p) => p.includes("latest")));
});

test("capture-only evidence skips automatic derivation, while stale exact evidence is explicitly superseded", async (t) => {
  const f = new StageFixture(t);
  const capture = await f.stage("capture", [
    "--feed-url",
    f.feed(""),
    "--advance",
    "false",
  ]);
  capture.result.definition_sha = capture.result.application_sha;
  const api = await evidenceServer(t, capture.result);
  const skipped = await f.stage(
    "render",
    ["--upstream-run", "1", "--upstream-attempt", "1"],
    { GITHUB_API_URL: api.url },
  );
  assert.equal(skipped.code, 0, skipped.stderr);
  assert.equal(skipped.result.outcome, "stage-only");
  assert.equal(skipped.result.archive_output, null);
  assert.equal(f.remoteTip(), capture.result.archive_output);
  capture.result.advance = capture.result.eligible = true;
  const source = f.source(
    "article.html",
    "<article><p>New evidence.</p></article>",
  );
  const newer = await f.stage("capture", [
    "--feed-url",
    f.feed(`<item><link>${source}</link></item>`),
  ]);
  const stale = await f.stage(
    "render",
    ["--upstream-run", "1", "--upstream-attempt", "1"],
    { GITHUB_API_URL: api.url },
  );
  assert.equal(stale.code, 0, stale.stderr);
  assert.equal(stale.result.outcome, "superseded");
  assert.equal(stale.result.eligible, false);
  assert.equal(stale.result.archive_output, null);
  assert.equal(f.remoteTip(), newer.result.archive_output);
});

test("invalid metadata, contradictory records and unsafe artifacts cannot authorize work or fall back to a branch tip", async (t) => {
  const { artifactZip } = await import("./stage-support.js");
  const f = new StageFixture(t);
  const capture = await f.stage("capture", ["--feed-url", f.feed("")]);
  capture.result.definition_sha = capture.result.application_sha;
  const original = capture.result;
  const artifact = {
    id: 12,
    name: "v2-stage-capture-1-1",
    expired: false,
    workflow_run: {
      id: 1,
      head_branch: "main",
      head_sha: original.definition_sha,
    },
  };
  const cases: [string, any, any][] = [
    ["wrong run", {}, { run: { id: 2 } }],
    ["newer attempt", {}, { run: { run_attempt: 2 } }],
    ["pending", {}, { run: { status: "in_progress" } }],
    ["failed rerun", {}, { run: { conclusion: "failure" } }],
    ["cancelled", {}, { run: { conclusion: "cancelled" } }],
    [
      "wrong repository",
      {},
      { run: { repository: { full_name: "foreign/repo" } } },
    ],
    [
      "foreign head",
      {},
      { run: { head_repository: { full_name: "foreign/repo" } } },
    ],
    ["wrong branch", {}, { run: { head_branch: "feature" } }],
    [
      "wrong workflow",
      {},
      { run: { path: ".github/workflows/mirror-and-publish.yml" } },
    ],
    ["wrong event", {}, { run: { event: "pull_request" } }],
    ["wrong server definition", {}, { run: { head_sha: "a".repeat(40) } }],
    ["missing artifact", {}, { artifacts: [] }],
    ["expired artifact", {}, { artifacts: [{ ...artifact, expired: true }] }],
    ["duplicate artifact", {}, { artifacts: [artifact, artifact] }],
    [
      "wrong artifact owner",
      {},
      {
        artifacts: [
          { ...artifact, workflow_run: { ...artifact.workflow_run, id: 2 } },
        ],
      },
    ],
    [
      "wrong artifact revision",
      {},
      {
        artifacts: [
          {
            ...artifact,
            workflow_run: {
              ...artifact.workflow_run,
              head_sha: "b".repeat(40),
            },
          },
        ],
      },
    ],
    ["legacy schema", { version: 1 }, {}],
    ["invalid stage", { stage: "publish" }, {}],
    ["wrong record repository", { repository: "foreign/repo" }, {}],
    ["wrong record branch", { branch: "other" }, {}],
    ["wrong archive branch", { archive_branch: "other" }, {}],
    ["wrong record run", { run_id: 2 }, {}],
    ["wrong record attempt", { attempt: 2 }, {}],
    ["wrong application", { application_sha: "b".repeat(40) }, {}],
    ["wrong definition", { definition_sha: "b".repeat(40) }, {}],
    ["invalid archive revision", { archive_output: "moving-tip" }, {}],
    ["false persistence", { persisted_revision: null }, {}],
    ["archive outcome contradiction", { outcome: "no-change" }, {}],
    ["eligibility contradiction", { eligible: false }, {}],
    ["boolean string", { advance: "true" }, {}],
    [
      "invalid counts",
      { counts: { created: -1, updated: 0, unchanged: 0 } },
      {},
    ],
    ["wrong origin", { origin: { run_id: 2, attempt: 1 } }, {}],
    ["unexpected upstream", { upstream: { run_id: 2, attempt: 1 } }, {}],
    [
      "failed record",
      {
        outcome: "failure",
        eligible: false,
        archive_output: null,
        diagnostic: "failed",
      },
      {},
    ],
    ["capture publication claim", { publication_output: "a".repeat(64) }, {}],
    ["malformed JSON", {}, { payload: artifactZip("{") }],
    ["unsafe path", {}, { payload: artifactZip(original, "../stage.json") }],
    ["oversized member", {}, { payload: artifactZip(" ".repeat(64001)) }],
    ["oversized response", {}, { payload: Buffer.alloc(2000001) }],
    ["API error", {}, { status: 503 }],
  ];
  for (const [name, patch, options] of cases)
    await t.test(name, async (child) => {
      const record = { ...original, ...patch };
      const api = await evidenceServer(child, record, options);
      const run = await f.stage(
        "render",
        ["--upstream-run", "1", "--upstream-attempt", "1"],
        { GITHUB_API_URL: api.url },
      );
      assert.notEqual(run.code, 0, `${name}: ${run.stdout}`);
      assert.equal(run.result.eligible, false);
      assert.equal(run.result.archive_output, null);
      assert.equal(f.remoteTip(), original.archive_output);
    });
});

test("render verification requires complete canonical identity evidence without defining deployment identity", async (t) => {
  const f = new StageFixture(t);
  await f.stage("capture", ["--feed-url", f.feed("")]);
  const render = await f.stage("render", ["--advance", "true"]);
  render.result.definition_sha = render.result.application_sha;
  for (const patch of [
    {},
    { publication_output: null },
    { publication_outcome: "initialized" },
    { publication_input: "a".repeat(64) },
  ])
    await t.test(JSON.stringify(patch), async (child) => {
      const api = await evidenceServer(child, { ...render.result, ...patch });
      const result = await f.stage(
        "verify",
        [
          "--upstream-run",
          "1",
          "--upstream-attempt",
          "1",
          "--upstream-stage",
          "render",
        ],
        { GITHUB_API_URL: api.url },
      );
      assert.equal(
        result.code === 0,
        Object.keys(patch).length === 0,
        result.stderr,
      );
    });
});

test("automatic render evidence proves inherited application and archive input through its exact capture origin", async (t) => {
  const f = new StageFixture(t);
  const capture = (await f.stage("capture", ["--feed-url", f.feed("")])).result;
  capture.definition_sha = capture.application_sha;
  const captureApi = await evidenceServer(t, capture);
  const render = (
    await f.stage(
      "render",
      ["--run-id", "2", "--upstream-run", "1", "--upstream-attempt", "1"],
      { GITHUB_API_URL: captureApi.url },
    )
  ).result;
  for (const [patch, succeeds] of [
    [{}, true],
    [{ archive_input: "a".repeat(40), outcome: "changed" }, false],
    [{ application_sha: "b".repeat(40) }, false],
    [{ origin: { run_id: 9, attempt: 1 } }, false],
  ] as const)
    await t.test(JSON.stringify(patch), async (child) => {
      const api = await evidenceServer(
        child,
        { ...render, ...patch },
        { run: { event: "workflow_run" }, additional: [capture] },
      );
      const verified = await f.stage(
        "verify",
        [
          "--upstream-stage",
          "render",
          "--upstream-run",
          "2",
          "--upstream-attempt",
          "1",
        ],
        { GITHUB_API_URL: api.url },
      );
      assert.equal(verified.code === 0, succeeds, verified.stderr);
    });
});

test("artifact redirects strip API credentials, and unsafe ZIP members fail without extraction", async (t) => {
  const { serve } = await import("./support.js");
  const { artifactZip } = await import("./stage-support.js");
  const f = new StageFixture(t);
  const capture = (await f.stage("capture", ["--feed-url", f.feed("")])).result;
  capture.definition_sha = capture.application_sha;
  let redirectedAuth: string | undefined;
  const download = await serve(t, (req, res) => {
    redirectedAuth = req.headers.authorization;
    res.end(artifactZip(capture));
  });
  const api = await serve(t, (req, res) => {
    assert.equal(req.headers.authorization, "Bearer fixture-token");
    if (req.url!.includes("/attempts/"))
      res.end(
        JSON.stringify({
          id: 1,
          run_attempt: 1,
          status: "completed",
          conclusion: "success",
          head_branch: "main",
          repository: { full_name: "fixture/archive" },
          head_repository: { full_name: "fixture/archive" },
          path: ".github/workflows/v2-capture.yml",
          event: "workflow_dispatch",
          head_sha: capture.definition_sha,
        }),
      );
    else if (req.url!.includes("/artifacts?"))
      res.end(
        JSON.stringify({
          artifacts: [
            {
              id: 12,
              name: "v2-stage-capture-1-1",
              expired: false,
              workflow_run: {
                id: 1,
                head_branch: "main",
                head_sha: capture.definition_sha,
              },
            },
          ],
        }),
      );
    else res.writeHead(302, { location: download }).end();
  });
  const result = await f.stage(
    "verify",
    ["--upstream-run", "1", "--upstream-attempt", "1"],
    { GITHUB_API_URL: api, GH_TOKEN: "fixture-token" },
  );
  assert.equal(result.code, 0, result.stderr);
  assert.equal(redirectedAuth, undefined);
  for (const mode of ["duplicate", "symlink", "crc"])
    await t.test(mode, async (child) => {
      const zip =
        mode === "crc"
          ? artifactZip(capture)
          : artifactZip(capture, "stage.json", mode as "duplicate" | "symlink");
      if (mode === "crc") zip[14] = zip[14]! ^ 1;
      const server = await evidenceServer(child, capture, { payload: zip });
      const invalid = await f.stage(
        "verify",
        ["--upstream-run", "1", "--upstream-attempt", "1"],
        { GITHUB_API_URL: server.url },
      );
      assert.notEqual(invalid.code, 0);
      assert.equal(invalid.result.eligible, false);
    });
});
