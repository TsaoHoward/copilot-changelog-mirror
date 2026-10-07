import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, seedArticle } from "./support.js";

const realGit = execFileSync("/bin/sh", ["-c", "command -v git"])
  .toString()
  .trim();
function gitWrapper(f: Fixture, script: string): NodeJS.ProcessEnv {
  const bin = join(f.dir, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "git"),
    `#!/bin/sh\n${script}\nexec '${realGit}' "$@"\n`,
  );
  chmodSync(join(bin, "git"), 0o755);
  return { PATH: `${bin}:${process.env.PATH}` };
}

test("invalid input and late normalization failures never partially commit canonical state", async (t) => {
  for (const failure of [
    "corrupt manifest",
    "legacy schema",
    "hash mismatch",
    "missing snapshot",
    "snapshot symlink",
    "body symlink",
    "legacy front matter",
    "empty HTML",
    "unusable HTML",
    "invalid UTF8",
  ]) {
    await t.test(failure, async (t) => {
      const f = new Fixture(t);
      const goodId = seedArticle(
        f,
        "<article><p>First valid article.</p></article>",
        "https://example.test/aaa-valid/",
      );
      const badSource = "https://example.test/zzz-invalid/";
      const raw =
        failure === "empty HTML"
          ? Buffer.alloc(0)
          : failure === "unusable HTML"
            ? Buffer.from(
                "<article><h1>Only title</h1><script>chrome</script></article>",
              )
            : failure === "invalid UTF8"
              ? Buffer.from([0xff, 0xfe])
              : Buffer.from("<article><p>Second body.</p></article>");
      const manifest = updateCapture(f.manifest(), badSource, {
        snapshot_sha256: sha256(raw),
        observed_at: "2026-10-01T00:00:00.000Z",
        discovery_title: "Second",
        discovery_published_at: null,
      });
      const badId = Object.keys(manifest.articles).find((id) => id !== goodId)!;
      const snapshot = `snapshots/${badId}.html`;
      let metadata = serializeManifest(manifest);
      if (failure === "corrupt manifest") metadata = "{bad JSON";
      if (failure === "legacy schema")
        metadata = '{"schema_version":1,"articles":{}}';
      if (failure === "hash mismatch")
        ((manifest.articles[badId]!.capture.snapshot_sha256 = "0".repeat(64)),
          (metadata = serializeManifest(manifest)));
      f.seed({
        "metadata.json": metadata,
        [snapshot]: raw,
        ...(failure === "legacy front matter"
          ? { [`posts/${badId}.md`]: "---\ntitle: legacy\n---\nBody\n" }
          : {}),
      });
      if (failure === "missing snapshot") f.seed({}, {}, [snapshot]);
      if (failure === "snapshot symlink")
        f.seed({}, { [snapshot]: "../../outside.html" });
      if (failure === "body symlink")
        f.seed({}, { [`posts/${badId}.md`]: "../../outside.md" });
      const before = f.tip();
      const tree = f.text("rev-parse", `${f.branch}^{tree}`);
      const result = await f.render();
      assert.equal(result.code, 1, failure);
      assert.equal(result.result.outcome, "failure");
      assert.equal(
        result.result.archive_input,
        before,
        "Failure should report its pinned input revision",
      );
      assert.equal(result.result.archive_output, null);
      assert.ok(!("publication_output" in result.result));
      assert.ok(result.stderr.trim());
      assert.equal(f.tip(), before);
      assert.equal(f.text("rev-parse", `${f.branch}^{tree}`), tree);
      assert.equal(f.text("status", "--porcelain"), "");
    });
  }
});

test("route collisions reject the whole batch without inventing a hash suffix", async (t) => {
  const f = new Fixture(t);
  seedArticle(
    f,
    "<article><p>First.</p></article>",
    "https://example.test/a/same/",
  );
  const html = "<article><p>Second.</p></article>";
  const manifest = updateCapture(f.manifest(), "https://example.test/b/same/", {
    snapshot_sha256: sha256(html),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: "Second",
    discovery_published_at: null,
  });
  const id = Object.values(manifest.articles).find((a) =>
    a.source_url.includes("/b/"),
  )!.article_id;
  f.seed({
    "metadata.json": serializeManifest(manifest),
    [`snapshots/${id}.html`]: html,
  });
  const before = f.tip();
  const result = await f.render();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /route collision.*\/posts\/same\//);
  assert.equal(f.tip(), before);
  assert.ok(
    Object.values(f.manifest().articles).every(
      (a: any) => a.canonical === null,
    ),
  );
});

test("render preserves staged/unstaged/untracked application work and ignores inherited Git overrides", async (t) => {
  const f = new Fixture(t);
  seedArticle(f, "<article><p>Body.</p></article>");
  writeFileSync(join(f.repo, "app.txt"), "staged version\n");
  f.git("add", "app.txt");
  writeFileSync(join(f.repo, "app.txt"), "unstaged version\n");
  writeFileSync(join(f.repo, "untracked.txt"), "local work\n");
  const head = f.text("rev-parse", "HEAD");
  const status = f.git("status", "--porcelain");
  const index = readFileSync(join(f.repo, ".git/index"));
  const external = join(f.dir, "external-index");
  writeFileSync(external, "external owned bytes");
  const result = await f.render([], {
    GIT_DIR: join(f.dir, "absent"),
    GIT_WORK_TREE: f.sources,
    GIT_INDEX_FILE: external,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(f.text("rev-parse", "HEAD"), head);
  assert.deepEqual(f.git("status", "--porcelain"), status);
  assert.deepEqual(readFileSync(join(f.repo, ".git/index")), index);
  assert.equal(
    readFileSync(join(f.repo, "app.txt"), "utf8"),
    "unstaged version\n",
  );
  assert.equal(
    readFileSync(join(f.repo, "untracked.txt"), "utf8"),
    "local work\n",
  );
  assert.equal(readFileSync(external, "utf8"), "external owned bytes");
});

test("render refuses checked-out, symbolic and default archive targets", async (t) => {
  const f = new Fixture(t);
  seedArticle(f, "<p>Body.</p>");
  const before = f.tip();
  for (const branch of ["main", "master", "../unsafe"])
    assert.equal((await f.render(["--data-branch", branch])).code, 1);
  f.git("branch", "develop");
  f.git("config", "init.defaultBranch", "develop");
  assert.equal((await f.render(["--data-branch", "develop"])).code, 1);
  f.git("symbolic-ref", "refs/heads/archive-alias", `refs/heads/${f.branch}`);
  assert.equal((await f.render(["--data-branch", "archive-alias"])).code, 1);
  f.git("worktree", "add", join(f.dir, "checked-out"), f.branch);
  const failed = await f.render();
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /checked out/);
  assert.equal(f.tip(), before);
});

test("render continues pinned remote ancestry in a fresh clone without fetching or pushing", async (t) => {
  const f = new Fixture(t);
  seedArticle(f, "<p>Saved remote body.</p>");
  const original = f.tip();
  const origin = join(f.dir, "origin.git");
  execFileSync("git", [
    "init",
    "-q",
    "--bare",
    "--initial-branch=main",
    origin,
  ]);
  f.git("remote", "add", "origin", origin);
  f.git("push", "origin", "main", f.branch);
  const clone = join(f.dir, "clone");
  execFileSync("git", ["clone", "-q", "--origin", "upstream", origin, clone]);
  execFileSync("git", ["-C", clone, "config", "user.name", "Fixture"]);
  execFileSync("git", [
    "-C",
    clone,
    "config",
    "user.email",
    "fixture@example.invalid",
  ]);
  const env = gitWrapper(
    f,
    'if [ "$3" = "fetch" ] || [ "$3" = "push" ]; then echo "network Git forbidden" >&2; exit 1; fi',
  );
  const result = await f.render(["--repo", clone], env);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.archive_input, original);
  assert.equal(
    execFileSync("git", ["-C", clone, "rev-parse", `${f.branch}^`])
      .toString()
      .trim(),
    original,
  );
  assert.equal(
    execFileSync("git", ["-C", origin, "rev-parse", f.branch])
      .toString()
      .trim(),
    original,
  );
  assert.equal(
    execFileSync("git", ["-C", clone, "status", "--porcelain"]).toString(),
    "",
  );
  const again = await f.render(["--repo", clone], env);
  assert.equal(again.result.outcome, "no-change");
});

test("Git write and commit failures leave the archive pinned and temporary indexes removed", async (t) => {
  for (const operation of ["hash-object", "write-tree", "commit-tree"]) {
    await t.test(operation, async (t) => {
      const f = new Fixture(t);
      seedArticle(f, "<p>Saved body.</p>");
      const before = f.tip();
      const env = gitWrapper(
        f,
        `if [ "$3" = "${operation}" ]; then echo 'injected failure' >&2; exit 1; fi`,
      );
      const failed = await f.render([], env);
      assert.equal(failed.code, 1);
      assert.match(failed.stderr, /injected failure/);
      assert.equal(failed.result.archive_input, before);
      assert.equal(failed.result.archive_output, null);
      assert.equal(f.tip(), before);
      assert.deepEqual(
        readdirSync(f.temporary).filter((name) =>
          name.startsWith("copilot-capture-"),
        ),
        [],
      );
      assert.equal(f.text("status", "--porcelain"), "");
    });
  }
});

test("a competing ref advancement is never overwritten or reported as successful", async (t) => {
  for (const unchanged of [false, true]) {
    await t.test(
      unchanged ? "no-change render" : "changed render",
      async (t) => {
        const f = new Fixture(t);
        seedArticle(f, "<p>Saved body.</p>");
        if (unchanged) assert.equal((await f.render()).code, 0);
        const before = f.tip();
        const tree = f.text("rev-parse", `${f.branch}^{tree}`);
        const competitor = f.text(
          "commit-tree",
          tree,
          "-p",
          before,
          "-m",
          "Competing update",
        );
        const marker = join(f.dir, "competition");
        const operation = unchanged ? "cat-file" : "write-tree";
        const env = gitWrapper(
          f,
          `if [ "$3" = "${operation}" ] && [ ! -e '${marker}' ]; then touch '${marker}'; '${realGit}' -C '${f.repo}' update-ref 'refs/heads/${f.branch}' '${competitor}' '${before}'; fi`,
        );
        const failed = await f.render([], env);
        assert.equal(failed.code, 1);
        assert.equal(failed.result.archive_output, null);
        assert.equal(failed.result.archive_input, before);
        assert.equal(f.tip(), competitor);
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
});

test("cleanup failure cannot advance the archive and invocation-owned resources are removed", async (t) => {
  const f = new Fixture(t);
  seedArticle(f, "<p>Saved body.</p>");
  const before = f.tip();
  const guard = join(f.dir, "cleanup-failure.mjs");
  writeFileSync(
    guard,
    `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.rm;
let injected = false;
fs.rm = async (...args) => {
  if (!injected && String(args[0]).includes('copilot-capture-')) {
    injected = true;
    throw new Error('injected cleanup failure');
  }
  return original(...args);
};
syncBuiltinESMExports();\n`,
  );
  const failed = await f.render([], { NODE_OPTIONS: `--import=${guard}` });
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /cleanup failure/);
  assert.equal(f.tip(), before);
  assert.equal(failed.result.archive_output, null);
  assert.deepEqual(
    readdirSync(f.temporary).filter((name) =>
      name.startsWith("copilot-capture-"),
    ),
    [],
  );
});
