import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, root } from "./support.js";

const text = (value: string): string => value.replace(/\s+/g, " ").trim();

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
      assert.ok(!body.startsWith("---\n"));
      let offset = 0;
      const normalized = text(body);
      for (const block of baseline.blocks) {
        const value = text(block.markdown);
        const position = normalized.indexOf(value, offset);
        assert.ok(
          position >= offset,
          `Missing or reordered frozen block: ${value}`,
        );
        offset = position + value.length;
      }
      const $ = load(new MarkdownIt({ html: true }).render(body));
      assert.equal($("h1").length, 0);
      assert.deepEqual(
        $("h2,h3,h4,h5,h6")
          .toArray()
          .map((h) => text($(h).text())),
        baseline.headings,
      );
      for (const chrome of [
        "Table of Contents",
        "Menu. Currently selected",
        "Back to changelog",
        "Copied",
        "minute read",
      ])
        assert.ok(!$.root().text().includes(chrome), chrome);
      assert.deepEqual(
        $("img")
          .toArray()
          .map((i) => ({ src: $(i).attr("src"), alt: $(i).attr("alt") ?? "" })),
        baseline.images,
      );
      for (const link of baseline.links)
        assert.ok(
          $("a")
            .toArray()
            .some(
              (a) =>
                $(a).attr("href") === new URL(link, baseline.source_url).href,
            ),
          link,
        );
      assert.deepEqual(
        $("strong")
          .toArray()
          .map((el) => text($(el).text())),
        baseline.strong,
      );
      for (const [tag, count] of Object.entries(baseline.lists))
        assert.equal($(tag).length, count, tag);
      assert.deepEqual(
        $("video")
          .toArray()
          .map((v) => $(v).attr("src")),
        baseline.videos,
      );
      const links = $("a[href^='#']").toArray();
      assert.equal(links.length, baseline.headings.length);
      for (const link of links) {
        const fragment = $(link).attr("href")!.slice(1);
        const anchor = $(`[id='${fragment}']`);
        assert.equal(anchor.length, 1);
        assert.equal(
          text(anchor.parent("p").nextAll("h2,h3,h4,h5,h6").first().text()),
          text($(link).text()),
        );
      }
    });
  }
  const tip = f.tip();
  assert.equal((await f.render()).result.outcome, "no-change");
  assert.equal(f.tip(), tip);
});
