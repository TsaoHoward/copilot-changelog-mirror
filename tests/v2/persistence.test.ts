import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DirectoryFixture } from "./directory-support.js";
import { root } from "./support.js";

const persistence = join(root, ".github/scripts/persist-stage.sh");
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

test("ordinary Git commit failure retains local Capture but blocks push and downstream", async (t) => {
  const { chmodSync } = await import("node:fs");
  const f = new DirectoryFixture(t);
  prepare(f);
  const before = remote(f, "rev-parse", "mirror-data-v2");
  assert.equal((await f.cli("capture", ["--feed-url", f.feed("")])).code, 0);
  const hook = join(f.archive, ".git/hooks/pre-commit");
  writeFileSync(
    hook,
    "#!/bin/sh\necho 'controlled commit failure' >&2\nexit 1\n",
  );
  chmodSync(hook, 0o755);
  const failed = persist(f, "capture");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /controlled commit failure/);
  assert.equal(failed.downstream, false);
  assert.equal(remote(f, "rev-parse", "mirror-data-v2"), before);
  assert.equal(f.git("rev-parse", "HEAD"), before);
  assert.ok(existsSync(join(f.archive, "metadata.json")));
  assert.ok(f.git("status", "--porcelain"));
  assert.equal(existsSync(join(f.dir, "outputs")), false);
});
