import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StageFixture } from "./stage-support.js";
import { root, serve } from "./support.js";
import { fixtureEnvironment } from "./environment-support.js";

const run = promisify(execFile);
async function setup(t: import("node:test").TestContext) {
  const f = new StageFixture(t);
  const files = {
    "snapshots/legacy.html":
      "<article><h1>Legacy only</h1><p>Old body</p></article>\n",
    "snapshots/legacy.json": '{"source_url":"https://example.test/legacy"}\n',
    "posts/legacy.md": "---\ntitle: Legacy only\n---\nOld body\n",
  };
  f.seed(files);
  f.seed(files);
  f.git("push", "-q", "origin", `${f.tip()}:refs/heads/mirror-data`);
  const legacy = f.tip();
  let active = false,
    busy = false,
    status = 200;
  let onRequest: (() => void) | undefined;
  const api = await serve(t, (req, res) => {
    onRequest?.();
    if (status !== 200) return void res.writeHead(status).end("API failure");
    if (req.url?.includes("/actions/workflows?"))
      res.end(
        JSON.stringify({
          workflows: [
            "mirror-and-publish.yml",
            "render-posts.yml",
            "publish-pages.yml",
          ].map((name, i) => ({
            id: i + 1,
            path: `.github/workflows/${name}`,
            state: active ? "active" : "disabled_manually",
          })),
        }),
      );
    else if (req.url?.includes("/actions/runs?"))
      res.end(
        JSON.stringify({
          workflow_runs: busy
            ? [
                {
                  id: 42,
                  path: ".github/workflows/publish-pages.yml",
                  status: "waiting",
                },
              ]
            : [],
        }),
      );
    else res.writeHead(404).end("Unexpected API request");
  });
  async function cutover(command = "checkpoint", extra: string[] = []) {
    let output;
    try {
      output = {
        code: 0,
        ...(await run(
          process.execPath,
          [
            "--import",
            "tsx",
            join(root, "src/v2/cutover-cli.ts"),
            command,
            "--repo",
            f.repo,
            "--repository",
            "fixture/archive",
            "--legacy-revision",
            legacy,
            "--state",
            join(f.dir, "cutover.json"),
            ...extra,
          ],
          { cwd: root, env: fixtureEnvironment({ GITHUB_API_URL: api }) },
        )),
      };
    } catch (error: any) {
      output = { code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
    return {
      ...output,
      result: output.stdout ? JSON.parse(output.stdout) : null,
    };
  }
  return {
    f,
    files,
    legacy,
    api,
    cutover,
    setActive: () => {
      active = true;
    },
    setBusy: () => {
      busy = true;
    },
    failApi: () => {
      status = 503;
    },
    onRequest: (fn: () => void) => {
      onRequest = fn;
    },
  };
}

test("checkpoint restores exact v1 blobs/history without changing caller state, then real capture bootstraps only fresh discovery", async (t) => {
  const { f, files, legacy, api, cutover } = await setup(t);
  writeFileSync(join(f.repo, "app.txt"), "staged\n");
  f.git("add", "app.txt");
  writeFileSync(join(f.repo, "app.txt"), "unstaged\n");
  writeFileSync(join(f.repo, "user.txt"), "untracked\n");
  const before = [
    f.text("rev-parse", "HEAD"),
    f.text("status", "--porcelain"),
    f.text("diff", "--cached"),
    f.text("diff"),
  ];
  const checkpoint = await cutover();
  assert.equal(checkpoint.code, 0, checkpoint.stderr);
  assert.equal(checkpoint.result.outcome, "checkpointed");
  assert.equal(checkpoint.result.legacy_revision, legacy);
  assert.equal(checkpoint.result.initial_archive_revision, null);
  assert.equal(checkpoint.result.restored_files.length, 3);
  assert.equal(checkpoint.result.history_count, 2);
  assert.equal(
    f
      .text("ls-remote", "origin", "refs/tags/v1-final-before-v2")
      .split(/\s/)[0],
    legacy,
  );
  assert.deepEqual(
    [
      f.text("rev-parse", "HEAD"),
      f.text("status", "--porcelain"),
      f.text("diff", "--cached"),
      f.text("diff"),
    ],
    before,
  );
  const verify = await cutover("verify");
  assert.equal(verify.code, 0, verify.stderr);
  const source = f.source(
    "current.html",
    "<article><h1>Current only</h1><p>Fresh body.</p></article>",
  );
  const capture = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--feed-url",
      f.feed(`<item><link>${source}</link></item>`),
    ],
    { GITHUB_API_URL: api },
  );
  assert.equal(capture.code, 0, capture.stderr);
  assert.equal(capture.result.archive_input, null);
  const v2 = f.remoteTip("mirror-data-v2")!;
  const manifest = JSON.parse(f.git("show", `${v2}:metadata.json`).toString());
  assert.equal(Object.keys(manifest.articles).length, 1);
  assert.equal(
    Object.values(manifest.articles).some((a: any) =>
      a.source_url.includes("legacy"),
    ),
    false,
  );
  assert.equal(f.text("rev-list", "--count", v2), "1");
  const rendered = await f.stage(
    "render",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--advance",
      "true",
    ],
    { GITHUB_API_URL: api },
  );
  assert.equal(rendered.code, 0, rendered.stderr);
  assert.equal(rendered.result.archive_input, v2);
  assert.equal(rendered.result.eligible, true);
  const renderedMetadata = JSON.parse(
    f.git("show", `${rendered.result.archive_output}:metadata.json`).toString(),
  );
  assert.equal(
    (Object.values(renderedMetadata.articles)[0] as any).canonical.title,
    "Current only",
  );
  assert.equal(f.remoteTip("mirror-data"), legacy);
  for (const [path, body] of Object.entries(files))
    assert.equal(f.git("show", `${legacy}:${path}`).toString(), body);
  assert.deepEqual(
    [
      f.text("rev-parse", "HEAD"),
      f.text("status", "--porcelain"),
      f.text("diff", "--cached"),
      f.text("diff"),
    ],
    before,
  );
});

test("checkpoint refuses active legacy writers before publishing any ref", async (t) => {
  const { f, cutover, setActive } = await setup(t);
  setActive();
  const result = await cutover();
  assert.notEqual(result.code, 0);
  assert.match(result.result.diagnostic, /quiescen|disabled/);
  assert.equal(
    f.text("ls-remote", "origin", "refs/tags/v1-final-before-v2"),
    "",
  );
});

test("checkpoint refuses queued downstream consumers and uncertain API evidence", async (t) => {
  for (const kind of ["busy", "api"] as const)
    await t.test(kind, async (child) => {
      const fixture = await setup(child);
      if (kind === "busy") fixture.setBusy();
      else fixture.failApi();
      const result = await fixture.cutover();
      assert.notEqual(result.code, 0);
      assert.match(
        result.result.diagnostic,
        kind === "busy" ? /Outstanding legacy/ : /API HTTP 503/,
      );
      assert.equal(
        fixture.f.text("ls-remote", "origin", "refs/tags/v1-final-before-v2"),
        "",
      );
    });
});

test("checkpoint refuses conflicting refs and unexplained nonempty v2 targets without destructive fallback", async (t) => {
  for (const kind of ["checkpoint", "target"] as const)
    await t.test(kind, async (child) => {
      const { f, cutover } = await setup(child);
      const ref =
        kind === "checkpoint"
          ? "refs/tags/v1-final-before-v2"
          : "refs/heads/mirror-data-v2";
      f.git("push", "-q", "origin", `HEAD:${ref}`);
      const before = f.text("ls-remote", "origin", ref);
      const result = await cutover();
      assert.notEqual(result.code, 0);
      assert.match(
        result.result.diagnostic,
        kind === "checkpoint"
          ? /Conflicting checkpoint/
          : /fresh.*target|nonempty/i,
      );
      assert.equal(f.text("ls-remote", "origin", ref), before);
    });
});

test("late legacy writes fail the checkpoint gate; production capture cannot bootstrap without it", async (t) => {
  const { f, legacy, api, cutover } = await setup(t);
  const denied = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--feed-url",
      f.feed(""),
    ],
    { GITHUB_API_URL: api },
  );
  assert.notEqual(denied.code, 0);
  assert.equal(f.remoteTip("mirror-data-v2"), null);
  assert.equal((await cutover()).code, 0);
  const newer = f.text(
    "commit-tree",
    f.text("rev-parse", `${legacy}^{tree}`),
    "-p",
    legacy,
    "-m",
    "Late legacy writer",
  );
  f.git("push", "-q", "origin", `${newer}:refs/heads/mirror-data`);
  const verify = await cutover("verify");
  assert.notEqual(verify.code, 0);
  assert.match(verify.result.diagnostic, /Legacy revision|checkpoint/);
  const rejected = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--feed-url",
      f.feed(""),
    ],
    { GITHUB_API_URL: api },
  );
  assert.notEqual(rejected.code, 0);
  assert.equal(f.remoteTip("mirror-data-v2"), null);
  assert.equal(
    readFileSync(join(f.dir, "cutover.json"), "utf8").includes(
      '"outcome": "failure"',
    ),
    true,
  );
});

test("a genuinely empty target keeps its own ancestry; a competing bootstrap blocks checkpoint publication", async (t) => {
  for (const race of [false, true])
    await t.test(
      race ? "competing bootstrap" : "empty target",
      async (child) => {
        const fixture = await setup(child);
        const { f, cutover } = fixture;
        const empty = f.text(
          "commit-tree",
          f.text("mktree"),
          "-m",
          "Independent empty target",
        );
        f.git("push", "-q", "origin", `${empty}:refs/heads/mirror-data-v2`);
        if (race) {
          let calls = 0;
          const newer = f.text(
            "commit-tree",
            f.text("rev-parse", "HEAD^{tree}"),
            "-p",
            empty,
            "-m",
            "Competing target writer",
          );
          fixture.onRequest(() => {
            if (++calls === 3)
              f.git(
                "push",
                "-q",
                "origin",
                `${newer}:refs/heads/mirror-data-v2`,
              );
          });
        }
        const result = await cutover();
        if (race) {
          assert.notEqual(result.code, 0);
          assert.equal(
            f.text("ls-remote", "origin", "refs/tags/v1-final-before-v2"),
            "",
          );
        } else {
          assert.equal(result.code, 0, result.stderr);
          assert.equal(result.result.initial_archive_revision, empty);
          const capture = await f.stage(
            "capture",
            [
              "--definition-repo",
              f.repo,
              "--archive-branch",
              "mirror-data-v2",
              "--feed-url",
              f.feed(""),
            ],
            { GITHUB_API_URL: fixture.api },
          );
          assert.equal(capture.code, 0, capture.stderr);
          assert.equal(
            f.text("rev-parse", `${f.remoteTip("mirror-data-v2")}^`),
            empty,
          );
        }
      },
    );
});

test("valid verification state copied after checkpoint cannot seed the first production capture", async (t) => {
  const { f, api, cutover } = await setup(t);
  assert.equal((await cutover()).code, 0);
  const source = f.source(
    "verification.html",
    "<article><h1>Verification only</h1><p>Imported corpus.</p></article>",
  );
  const isolated = await f.stage("capture", [
    "--definition-repo",
    f.repo,
    "--archive-branch",
    "isolated-verification",
    "--feed-url",
    f.feed(`<item><link>${source}</link></item>`),
  ]);
  assert.equal(isolated.code, 0, isolated.stderr);
  f.git(
    "push",
    "-q",
    "origin",
    `${isolated.result.archive_output}:refs/heads/mirror-data-v2`,
  );
  const verify = await cutover("verify");
  assert.notEqual(verify.code, 0);
  assert.match(
    verify.result.diagnostic,
    /Unexplained production archive.*never promote/,
  );
  const capture = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--feed-url",
      f.feed(""),
    ],
    { GITHUB_API_URL: api },
  );
  assert.notEqual(capture.code, 0);
  assert.equal(f.remoteTip("mirror-data-v2"), isolated.result.archive_output);
  assert.equal(
    f.text("ls-remote", "origin", "refs/tags/v2-initial-capture"),
    "",
  );
});

test("initial capture and immutable bootstrap witness persist atomically; rejection leaves both absent", async (t) => {
  const { f, api, cutover } = await setup(t);
  assert.equal((await cutover()).code, 0);
  writeFileSync(
    join(f.remote, "hooks/pre-receive"),
    '#!/bin/sh\nwhile read old new ref; do\n if [ "$ref" = refs/tags/v2-initial-capture ]; then exit 1; fi\ndone\n',
    { mode: 0o755 },
  );
  const capture = await f.stage(
    "capture",
    [
      "--definition-repo",
      f.repo,
      "--archive-branch",
      "mirror-data-v2",
      "--feed-url",
      f.feed(""),
    ],
    { GITHUB_API_URL: api },
  );
  assert.notEqual(capture.code, 0);
  assert.equal(capture.result.archive_output, null);
  assert.equal(f.remoteTip("mirror-data-v2"), null);
  assert.equal(
    f.text("ls-remote", "origin", "refs/tags/v2-initial-capture"),
    "",
  );
});
