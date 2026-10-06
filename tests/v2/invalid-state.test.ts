import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { Fixture, serve } from "./support.js";

test("invalid persisted state fails before acquisition without changing archive or application work", async (t) => {
  const cases = [
    "malformed",
    "duplicate-key",
    "version",
    "unknown-field",
    "identity",
    "date",
    "hash",
    "missing",
    "symlink",
    "legacy",
    "front-matter",
    "application",
  ];
  for (const kind of cases) {
    await t.test(kind, async (t) => {
      const f = new Fixture(t);
      const source = f.source("article.html", "original bytes");
      const feed = f.feed(`<item><link>${source}</link></item>`);
      assert.equal((await f.cli(feed)).code, 0);
      const manifest = f.manifest();
      const id = Object.keys(manifest.articles)[0]!;
      const article = manifest.articles[id];
      const snapshot = `snapshots/${id}.html`;
      let metadata = "";
      const files: Record<string, string> = {};
      const links: Record<string, string> = {};
      if (kind === "malformed") metadata = "{";
      if (kind === "duplicate-key")
        metadata = '{"schema_version":2,"schema_version":2,"articles":{}}';
      if (kind === "version") manifest.schema_version = 1;
      if (kind === "unknown-field") article.capture.last_checked = "now";
      if (kind === "identity")
        article.source_url = "https://other.example/article.html";
      if (kind === "date")
        article.capture.observed_at = "2026-02-30T00:00:00.000Z";
      if (kind === "hash") files[snapshot] = "corrupt bytes";
      if (kind === "symlink") links[snapshot] = "/etc/passwd";
      if (kind === "legacy") files[`snapshots/${id}.json`] = "{}";
      if (kind === "front-matter")
        files[`posts/${id}.md`] = "---\ntitle: Legacy\n---\nBody";
      if (kind === "application") files["app.txt"] = "application state";
      files["metadata.json"] = metadata || JSON.stringify(manifest);
      f.seed(files, links);
      if (kind === "missing") {
        f.git("worktree", "add", `${f.dir}/delete`, f.branch);
        f.git("-C", `${f.dir}/delete`, "rm", snapshot);
        f.git("-C", `${f.dir}/delete`, "commit", "-qm", "missing snapshot");
        f.git("worktree", "remove", `${f.dir}/delete`);
      }
      writeFileSync(`${f.repo}/app.txt`, "staged\n");
      f.git("add", "app.txt");
      writeFileSync(`${f.repo}/app.txt`, "unstaged\n");
      writeFileSync(`${f.repo}/notes.txt`, "untracked\n");
      const before = f.tip();
      const head = f.text("rev-parse", "HEAD");
      const index = f.git("diff", "--cached");
      const status = f.git("status", "--porcelain");
      let requests = 0;
      const base = await serve(t, (_req, res) => {
        requests++;
        res.end("<rss><channel/></rss>");
      });
      const result = await f.cli(base);
      assert.equal(result.code, 1, result.stderr);
      assert.equal(result.result.outcome, "failure");
      assert.equal(result.result.archive_output, null);
      assert.equal(requests, 0);
      assert.equal(f.tip(), before);
      assert.equal(f.text("rev-parse", "HEAD"), head);
      assert.deepEqual(f.git("diff", "--cached"), index);
      assert.deepEqual(f.git("status", "--porcelain"), status);
      assert.equal(readFileSync(`${f.repo}/app.txt`, "utf8"), "unstaged\n");
      assert.equal(readFileSync(`${f.repo}/notes.txt`, "utf8"), "untracked\n");
    });
  }
});

test("legacy or arbitrary application archives without a manifest are never treated as empty bootstrap state", async (t) => {
  const f = new Fixture(t);
  f.seed({
    "snapshots/old.json": "{}",
    "snapshots/old.html": "old",
    "posts/old.md": "---\ntitle: Old\n---\n",
  });
  const before = f.tip();
  const failed = await f.cli(f.feed(""));
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /v2.*reset|reset.*v2/i);
  assert.equal(f.tip(), before);
});
