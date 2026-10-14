import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { verifyEditorialBaseline } from "./production-oracle.js";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, root } from "./support.js";

test("all six production articles retain the frozen 123 editorial blocks, structure, media and navigation", async (t) => {
  const f = new Fixture(t);
  const directory = join(root, "tests/fixtures/production");
  let manifest = emptyManifest();
  const files: Record<string, string | Buffer> = {};
  const corpus = readdirSync(directory)
    .filter((path) => path.endsWith(".json"))
    .sort()
    .map((path) => {
      const baseline = JSON.parse(readFileSync(join(directory, path), "utf8"));
      const bytes = readFileSync(
        join(directory, path.replace(/\.json$/, ".html")),
      );
      assert.equal(sha256(bytes), baseline.sha256);
      manifest = updateCapture(manifest, baseline.source_url, {
        snapshot_sha256: baseline.sha256,
        observed_at: "2026-10-02T06:17:26.000Z",
        discovery_title: "Feed fallback",
        discovery_published_at: null,
      });
      const article = Object.values(manifest.articles).find(
        (a) => a.source_url === baseline.source_url,
      )!;
      files[`snapshots/${article.article_id}.html`] = bytes;
      return { baseline, bytes, id: article.article_id };
    });
  files["metadata.json"] = serializeManifest(manifest);
  f.seed(files);
  const result = await f.render();
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.result.counts, {
    rendered: 6,
    updated: 6,
    unchanged: 0,
  });
  assert.equal(
    corpus.reduce((sum, c) => sum + c.baseline.blocks.length, 0),
    123,
  );
  for (const { baseline, bytes, id } of corpus) {
    await t.test(id, () => {
      const body = f.git("show", `${f.branch}:posts/${id}.md`).toString();
      assert.equal(f.manifest().articles[id].canonical.title, baseline.title);
      assert.deepEqual(
        f.git("show", `${f.branch}:snapshots/${id}.html`),
        bytes,
      );
      verifyEditorialBaseline(body, baseline);
    });
  }
  const tip = f.tip();
  assert.equal((await f.render()).result.outcome, "no-change");
  assert.equal(f.tip(), tip);
});
