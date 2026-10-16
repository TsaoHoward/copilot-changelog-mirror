import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DirectoryFixture } from "./directory-support.js";
import { root } from "./support.js";

const persistence = join(root, ".github/isolated/persist-stage.sh");
function remote(f: DirectoryFixture, ...args: string[]) {
  return execFileSync("git", ["--git-dir", f.remote, ...args])
    .toString()
    .trim();
}
function prepare(f: DirectoryFixture) {
  execFileSync("git", ["init", "--bare", "-q", f.remote]);
  f.git("remote", "add", "origin", f.remote);
  f.git("push", "-q", "origin", "HEAD:mirror-data-v2");
}
function persist(f: DirectoryFixture, stage: "capture" | "render") {
  const downstream = join(f.dir, "downstream");
  const result = spawnSync(
    "bash",
    [
      "-e",
      "-o",
      "pipefail",
      "-c",
      'bash "$SCRIPT" "$STAGE" "$ARCHIVE" && touch "$DOWNSTREAM"',
    ],
    {
      env: {
        ...process.env,
        SCRIPT: persistence,
        STAGE: stage,
        ARCHIVE: f.archive,
        DOWNSTREAM: downstream,
        GITHUB_OUTPUT: join(f.dir, "outputs"),
        GITHUB_STEP_SUMMARY: join(f.dir, "summary"),
      },
      encoding: "utf8",
    },
  );
  return { ...result, downstream: existsSync(downstream) };
}

test("reviewed Actions persistence pushes Capture before Render and a separate Render before build; no-change continues", async (t) => {
  const f = new DirectoryFixture(t);
  prepare(f);
  const source = f.source(
    "saved.html",
    "<article><h1>Saved title</h1><p>Durable body.</p></article>",
  );
  const feed = f.feed(`<item><link>${source}</link></item>`);
  assert.equal((await f.cli("capture", ["--feed-url", feed])).code, 0);
  assert.equal(persist(f, "capture").status, 0);
  const c = remote(f, "rev-parse", "mirror-data-v2");
  const article = Object.values(f.manifest().articles)[0] as any;
  assert.equal(
    JSON.parse(remote(f, "show", `${c}:metadata.json`)).articles[
      article.article_id
    ].canonical,
    null,
  );
  assert.match(
    remote(f, "show", `${c}:snapshots/${article.article_id}.html`),
    /Durable body/,
  );
  assert.equal((await f.cli("render")).code, 0);
  assert.equal(persist(f, "render").status, 0);
  const r = remote(f, "rev-parse", "mirror-data-v2");
  assert.notEqual(r, c);
  assert.equal(remote(f, "rev-parse", `${r}^`), c);
  assert.equal(
    remote(f, "show", `${r}:posts/${article.article_id}.md`),
    "Durable body.",
  );
  // Reuse the native CLI's output-safety failure, not another compiler fault matrix.
  const failedBuild = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      join(root, "src/v2/native-site-cli.ts"),
      "--archive-dir",
      f.archive,
      "--output",
      f.archive,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(failedBuild.status, 1, failedBuild.stderr);
  assert.equal(JSON.parse(failedBuild.stdout).outcome, "failure");
  assert.equal(remote(f, "rev-parse", "mirror-data-v2"), r);
  assert.equal(
    (await f.cli("capture", ["--feed-url", feed])).result.outcome,
    "no-change",
  );
  assert.equal(persist(f, "capture").status, 0);
  assert.equal((await f.cli("render")).result.outcome, "no-change");
  assert.equal(persist(f, "render").status, 0);
  assert.equal(remote(f, "rev-parse", "mirror-data-v2"), r);
  assert.match(
    readFileSync(join(f.dir, "summary"), "utf8"),
    /Confirmed pushed/,
  );
});

for (const stage of ["capture", "render"] as const) {
  test(`${stage} non-fast-forward rejection preserves competitor and stops downstream, including no-change`, async (t) => {
    for (const changed of [true, false]) {
      const f = new DirectoryFixture(t);
      prepare(f);
      const source = f.source(
        "article.html",
        "<article><h1>Saved</h1><p>Durable input.</p></article>",
      );
      assert.equal(
        (
          await f.cli("capture", [
            "--feed-url",
            f.feed(`<item><link>${source}</link></item>`),
          ])
        ).code,
        0,
      );
      if (stage === "render" || !changed) {
        assert.equal(persist(f, "capture").status, 0);
        if (!changed && stage === "render") {
          assert.equal((await f.cli("render")).code, 0);
          assert.equal(persist(f, "render").status, 0);
        }
      }
      if (stage === "render") assert.equal((await f.cli("render")).code, 0);
      const competitor = join(f.dir, "competitor");
      execFileSync("git", [
        "clone",
        "-q",
        "-b",
        "mirror-data-v2",
        f.remote,
        competitor,
      ]);
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", competitor, ...args])
          .toString()
          .trim();
      git("config", "user.name", "Competitor");
      git("config", "user.email", "competitor@example.invalid");
      writeFileSync(
        join(competitor, "competitor.txt"),
        "Competing durable revision\n",
      );
      git("add", ".");
      git("commit", "-qm", "External writer");
      git("push", "-q", "origin", "HEAD:mirror-data-v2");
      const competing = git("rev-parse", "HEAD");
      // Remove the prior positive-control downstream marker.
      const { rmSync } = await import("node:fs");
      rmSync(join(f.dir, "downstream"), { force: true });
      const result = persist(f, stage);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.downstream, false);
      assert.equal(remote(f, "rev-parse", "mirror-data-v2"), competing);
      assert.equal(
        remote(f, "show", `${competing}:competitor.txt`),
        "Competing durable revision",
      );
      assert.match(
        readFileSync(join(f.dir, "summary"), "utf8"),
        /Push failed or outcome uncertain/,
      );
    }
  });
}

test("a nonzero push result blocks downstream even when the remote accepted the candidate", async (t) => {
  const { mkdirSync, chmodSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  prepare(f);
  assert.equal((await f.cli("capture", ["--feed-url", f.feed("")])).code, 0);
  const wrapperDir = join(f.dir, "bin");
  mkdirSync(wrapperDir);
  const actualGit = execFileSync("which", ["git"]).toString().trim();
  // Focused caller exit-status control, not a simulated Git transport/protocol.
  const wrapper = join(wrapperDir, "git");
  writeFileSync(
    wrapper,
    '#!/usr/bin/env bash\n"$ACTUAL_GIT" "$@"\ncode=$?\nif [[ " $* " == *" push "* && $code == 0 ]]; then exit 1; fi\nexit "$code"\n',
  );
  chmodSync(wrapper, 0o755);
  const result = spawnSync(
    "bash",
    ["-e", "-c", 'bash "$SCRIPT" capture "$ARCHIVE" && touch "$DOWNSTREAM"'],
    {
      env: {
        ...process.env,
        PATH: `${wrapperDir}:${process.env.PATH}`,
        ACTUAL_GIT: actualGit,
        SCRIPT: persistence,
        ARCHIVE: f.archive,
        DOWNSTREAM: join(f.dir, "downstream"),
        GITHUB_OUTPUT: join(f.dir, "outputs"),
        GITHUB_STEP_SUMMARY: join(f.dir, "summary"),
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.equal(existsSync(join(f.dir, "downstream")), false);
  assert.equal(
    remote(f, "rev-parse", "mirror-data-v2"),
    f.git("rev-parse", "HEAD"),
  );
  assert.equal(
    existsSync(join(f.dir, "outputs")),
    false,
    "uncertain push must not announce confirmed output",
  );
});

test("republish builds with actual offline tools without altering saved Git bytes, index, refs or history", async (t) => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const f = new DirectoryFixture(t);
  prepare(f);
  const source = f.source(
    "publication.html",
    "<article><h1>Complete saved publication</h1><p>Reader search content.</p></article>",
  );
  assert.equal(
    (
      await f.cli("capture", [
        "--feed-url",
        f.feed(`<item><link>${source}</link></item>`),
      ])
    ).code,
    0,
  );
  assert.equal(persist(f, "capture").status, 0);
  assert.equal((await f.cli("render")).code, 0);
  assert.equal(persist(f, "render").status, 0);
  const before = {
    index: readFileSync(join(f.archive, ".git/index")),
    refs: f.git("show-ref"),
    log: remote(f, "log", "--format=%H", "mirror-data-v2"),
    tree: f.git("ls-tree", "-r", "HEAD"),
  };
  const result = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      join(root, "tests/v2/block-network.mjs"),
      "--import",
      "tsx",
      join(root, "src/v2/native-site-cli.ts"),
      "--archive-dir",
      f.archive,
      "--output",
      join(f.dir, "publication"),
      "--base",
      "/isolated/",
    ],
    {
      cwd: root,
      env: { ...process.env, COPILOT_NETWORK_LOG: join(f.dir, "network.log") },
    },
  );
  assert.equal(JSON.parse(result.stdout).outcome, "success", result.stderr);
  assert.equal(JSON.parse(result.stdout).article_count, 1);
  assert.equal(existsSync(join(f.dir, "network.log")), false);
  assert.deepEqual(readFileSync(join(f.archive, ".git/index")), before.index);
  assert.equal(f.git("show-ref"), before.refs);
  assert.equal(remote(f, "log", "--format=%H", "mirror-data-v2"), before.log);
  assert.equal(f.git("ls-tree", "-r", "HEAD"), before.tree);
  assert.equal(f.git("status", "--porcelain"), "");
});
