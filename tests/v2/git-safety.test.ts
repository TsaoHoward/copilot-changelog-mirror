import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { test } from "node:test";
import { Fixture, serve, root } from "./support.js";

const oneArticle = (f: Fixture): string =>
  f.feed(`<item><link>${f.source("article.html", "evidence")}</link></item>`);

test("a fresh clone continues remote-only archive ancestry and preserves articles outside discovery", async (t) => {
  const f = new Fixture(t);
  assert.equal((await f.cli(oneArticle(f))).code, 0);
  const original = f.tip();
  const manifest = f.git("show", `${f.branch}:metadata.json`);
  const origin = `${f.dir}/origin.git`;
  execFileSync("git", [
    "init",
    "-q",
    "--bare",
    "--initial-branch=main",
    origin,
  ]);
  f.git("remote", "add", "origin", origin);
  f.git("push", "origin", "main", f.branch);
  const clone = `${f.dir}/clone`;
  execFileSync("git", ["clone", "-q", origin, clone]);
  execFileSync("git", ["-C", clone, "config", "user.name", "Fixture"]);
  execFileSync("git", [
    "-C",
    clone,
    "config",
    "user.email",
    "fixture@example.invalid",
  ]);
  const feed = oneArticle(f);
  const same = await f.cli(feed, ["--repo", clone]);
  assert.equal(same.result.outcome, "no-change", same.stderr);
  assert.equal(same.result.archive_input, original);
  assert.equal(same.result.archive_output, original);
  assert.throws(() =>
    execFileSync(
      "git",
      ["-C", clone, "show-ref", "--verify", `refs/heads/${f.branch}`],
      { stdio: "pipe" },
    ),
  );
  const additional = f.source("new.html", "new evidence");
  f.feed(`<item><link>${additional}</link></item>`);
  const changed = await f.cli(feed, ["--repo", clone]);
  assert.equal(changed.result.outcome, "changed", changed.stderr);
  assert.equal(changed.result.archive_input, original);
  assert.equal(
    execFileSync("git", ["-C", clone, "rev-parse", `${f.branch}^`])
      .toString()
      .trim(),
    original,
  );
  const output = JSON.parse(
    execFileSync("git", [
      "-C",
      clone,
      "show",
      `${f.branch}:metadata.json`,
    ]).toString(),
  );
  const older = JSON.parse(manifest.toString());
  const oldId = Object.keys(older.articles)[0]!;
  assert.deepEqual(output.articles[oldId], older.articles[oldId]);
  assert.equal(Object.keys(output.articles).length, 2);
  assert.equal(
    execFileSync("git", ["-C", clone, "status", "--porcelain"]).toString(),
    "",
  );
});

test("archive targets reject checked-out branches, symbolic aliases and configured default branches", async (t) => {
  const f = new Fixture(t);
  const feed = oneArticle(f);
  const head = f.text("rev-parse", "HEAD");
  for (const branch of ["main", "master", "../unsafe"]) {
    const failed = await f.cli(feed, ["--data-branch", branch]);
    assert.equal(failed.code, 1);
  }
  f.git("branch", "develop");
  f.git("config", "init.defaultBranch", "develop");
  f.git("switch", "-q", "-c", "application-feature");
  const configured = await f.cli(feed, ["--data-branch", "develop"]);
  assert.equal(
    configured.code,
    1,
    "configured default branch must be protected while working on a feature",
  );
  assert.match(configured.stderr, /default branch/);
  f.git("symbolic-ref", `refs/heads/${f.branch}`, "refs/heads/main");
  assert.equal((await f.cli(feed)).code, 1);
  f.git("symbolic-ref", "--delete", `refs/heads/${f.branch}`);
  assert.equal((await f.cli(feed)).code, 0);
  const before = f.tip();
  const worktree = `${f.dir}/user-archive`;
  f.git("worktree", "add", worktree, f.branch);
  writeFileSync(`${worktree}/user.txt`, "user archive work");
  const unsafe = await f.cli(feed);
  assert.equal(unsafe.code, 1);
  assert.match(unsafe.stderr, /checked out|worktree/i);
  assert.equal(
    readFileSync(`${worktree}/user.txt`, "utf8"),
    "user archive work",
  );
  assert.equal(f.tip(), before);
  assert.equal(f.text("rev-parse", "HEAD"), head);
});

test("capture ignores inherited Git overrides and leaves external index and working tree intact", async (t) => {
  const f = new Fixture(t);
  const index = `${f.dir}/user-index`;
  writeFileSync(index, "user-owned index bytes");
  const result = await f.cli(oneArticle(f), [], {
    GIT_INDEX_FILE: index,
    GIT_DIR: `${f.dir}/does-not-exist`,
    GIT_WORK_TREE: f.sources,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(readFileSync(index, "utf8"), "user-owned index bytes");
  assert.equal(f.text("status", "--porcelain"), "");
});

test("write and commit failures preserve the pinned archive and clean temporary indexes, including failed bootstrap", async (t) => {
  const realGit = execFileSync("/bin/sh", ["-c", "command -v git"])
    .toString()
    .trim();
  for (const existing of [false, true]) {
    for (const operation of ["hash-object", "write-tree", "commit-tree"]) {
      await t.test(
        `${existing ? "existing" : "bootstrap"} ${operation}`,
        async (t) => {
          const f = new Fixture(t);
          const feed = oneArticle(f);
          if (existing) assert.equal((await f.cli(feed)).code, 0);
          const before = existing ? f.tip() : null;
          f.source("article.html", "changed bytes");
          const bin = `${f.dir}/bin`;
          mkdirSync(bin);
          writeFileSync(
            `${bin}/git`,
            `#!/bin/sh\nif [ "$3" = "${operation}" ]; then echo "injected ${operation} failure" >&2; exit 1; fi\nexec '${realGit}' "$@"\n`,
          );
          chmodSync(`${bin}/git`, 0o755);
          const failed = await f.cli(feed, [], {
            PATH: `${bin}:${process.env.PATH}`,
          });
          assert.equal(failed.code, 1);
          assert.equal(failed.result.outcome, "failure");
          assert.equal(failed.result.archive_output, null);
          assert.match(failed.stderr, /injected/);
          if (existing) assert.equal(f.tip(), before);
          else assert.throws(() => f.tip());
          assert.deepEqual(
            readdirSync(f.temporary).filter((name) =>
              name.startsWith("copilot-capture-"),
            ),
            [],
          );
          assert.equal(f.text("status", "--porcelain"), "");
        },
      );
    }
  }
});

test("a competing archive commit cannot be overwritten after input is pinned", async (t) => {
  const f = new Fixture(t);
  assert.equal((await f.cli(oneArticle(f))).code, 0);
  const before = f.tip();
  let competing: string | null = null;
  const base = await serve(t, (req, res) => {
    if (req.url === "/feed")
      res.end(
        "<rss><channel><item><link>/new.html</link></item></channel></rss>",
      );
    else {
      const manifest = f.manifest();
      const article = Object.values(manifest.articles)[0] as any;
      article.canonical = {
        title: "Competing render",
        published_at: null,
        publication_path: "/posts/article/",
      };
      f.seed({ "metadata.json": JSON.stringify(manifest) });
      competing = f.tip();
      res.end("new evidence");
    }
  });
  const failed = await f.cli(`${base}/feed`);
  assert.equal(failed.code, 1);
  assert.equal(failed.result.archive_input, before);
  assert.equal(failed.result.archive_output, null);
  assert.match(failed.stderr, /update-ref|expected|lock/i);
  assert.equal(f.tip(), competing);
  assert.deepEqual(
    readdirSync(f.temporary).filter((name) =>
      name.startsWith("copilot-capture-"),
    ),
    [],
  );
});

test("bare invocation requires an explicit subcommand and invalid options return truthful failure JSON", async (t) => {
  const f = new Fixture(t);
  try {
    execFileSync(
      process.execPath,
      ["--import", "tsx", `${root}/src/v2/cli.ts`],
      { cwd: root, stdio: "pipe" },
    );
    assert.fail("bare invocation must fail");
  } catch (error: any) {
    assert.equal(error.status, 1);
    assert.equal(JSON.parse(error.stdout).outcome, "failure");
    assert.match(error.stderr.toString(), /explicit capture/);
  }
  for (const options of [
    ["--timeout-ms", "0"],
    ["--timeout-ms", "invalid"],
    ["--unexpected"],
  ]) {
    const result = await f.cli(f.feed(""), options);
    assert.equal(result.code, 1);
    assert.equal(result.result.outcome, "failure");
    assert.equal(result.result.archive_output, null);
    assert.throws(() => f.tip());
  }
});
