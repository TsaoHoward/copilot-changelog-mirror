import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, root } from "./support.js";
import { exportArchive, siteCommand } from "./site-support.js";

const text = (value: string) => value.replace(/\s+/g, " ").trim();
const sourceText = (node: any): string =>
  node.type === "text"
    ? node.data
    : (node.children ?? []).map(sourceText).join(" ");
function validateLocalReferences(output: string, base: string, page: string) {
  const $ = load(readFileSync(page, "utf8"));
  for (const element of $("[href],[src]").toArray()) {
    for (const attribute of ["href", "src"]) {
      const value = $(element).attr(attribute);
      if (!value || /^(?:https?:|mailto:|data:)/.test(value)) continue;
      if (value.startsWith("#")) {
        assert.equal($(`[id='${value.slice(1)}']`).length, 1, value);
      } else {
        assert.ok(value.startsWith(base), value);
        if (base !== "/")
          assert.ok(
            !value.slice(base.length).startsWith(base.slice(1)),
            `Double base: ${value}`,
          );
        const path = value.slice(base.length).split("#")[0]!;
        assert.ok(
          existsSync(
            join(
              output,
              path.endsWith("/") || !path ? `${path}index.html` : path,
            ),
          ),
          value,
        );
      }
    }
  }
}

test("real offline Astro output preserves all six production articles' frozen 123 ordered blocks and media", async (t) => {
  const f = new Fixture(t);
  const directory = join(root, "tests/fixtures/production");
  let manifest = emptyManifest();
  const files: Record<string, Buffer | string> = {};
  const corpus = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const baselineBytes = readFileSync(join(directory, name));
      const baseline = JSON.parse(baselineBytes.toString());
      const bytes = readFileSync(
        join(directory, name.replace(/\.json$/, ".html")),
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
      return { baseline, baselineBytes, name, id: article.article_id };
    });
  files["metadata.json"] = serializeManifest(manifest);
  f.seed(files);
  assert.equal((await f.render()).code, 0);
  const revision = f.tip();
  const archive = exportArchive(f);
  const archiveBytes = f.git("archive", revision);
  assert.equal(
    corpus.reduce((sum, c) => sum + c.baseline.blocks.length, 0),
    123,
  );
  for (const base of ["/copilot-changelog-mirror/", "/"]) {
    const output = join(f.dir, base === "/" ? "root-output" : "project-output");
    const built = await siteCommand(f, archive, "build", [
      "--output",
      output,
      "--base",
      base,
    ]);
    assert.equal(built.code, 0, built.stderr);
    assert.equal(built.result.article_count, 6);
    validateLocalReferences(output, base, join(output, "index.html"));
    for (const { baseline, baselineBytes, name, id } of corpus) {
      await t.test(`${base}${id}`, () => {
        const route = f.manifest().articles[id].canonical.publication_path;
        const page = join(output, route, "index.html");
        const $ = load(readFileSync(page, "utf8"));
        const body = $(".article-body");
        assert.equal($("h1").length, 1);
        assert.equal($("h1").text(), baseline.title);
        // Frozen source text uses separators between HTML text nodes.
        const content = text(sourceText(body[0]));
        let offset = 0;
        for (const block of baseline.blocks) {
          const value = text(block.text);
          const position = content.indexOf(value, offset);
          assert.ok(
            position >= offset,
            `Missing or reordered frozen block: ${value}`,
          );
          offset = position + value.length;
        }
        assert.deepEqual(
          body
            .find("h2,h3,h4,h5,h6")
            .toArray()
            .map((h) => text($(h).text())),
          baseline.headings,
        );
        assert.deepEqual(
          body
            .find("img")
            .toArray()
            .map((i) => ({
              src: $(i).attr("src"),
              alt: $(i).attr("alt") ?? "",
            })),
          baseline.images,
        );
        assert.deepEqual(
          body
            .find("strong")
            .toArray()
            .map((i) => text($(i).text())),
          baseline.strong,
        );
        for (const [tag, count] of Object.entries(baseline.lists))
          assert.equal(body.find(tag).length, count, tag);
        assert.deepEqual(
          body
            .find("video")
            .toArray()
            .map((v) => $(v).attr("src")),
          baseline.videos,
        );
        for (const link of baseline.links)
          assert.ok(
            body
              .find("a")
              .toArray()
              .some(
                (a) =>
                  $(a).attr("href") === new URL(link, baseline.source_url).href,
              ),
            link,
          );
        assert.equal($("a.source").attr("href"), baseline.source_url);
        for (const chrome of [
          "Copied",
          "Back to changelog",
          "Menu. Currently selected",
          "minute read",
        ])
          assert.ok(!body.text().includes(chrome), chrome);
        for (const link of body.find("a[href^='#']").toArray()) {
          const target = $(`[id='${$(link).attr("href")!.slice(1)}']`);
          assert.equal(target.length, 1);
          assert.equal(
            text(target.parent("p").nextAll("h2,h3,h4,h5,h6").first().text()),
            text($(link).text()),
          );
        }
        validateLocalReferences(output, base, page);
        assert.deepEqual(readFileSync(join(directory, name)), baselineBytes);
        assert.equal(
          sha256(readFileSync(join(archive, "snapshots", `${id}.html`))),
          baseline.sha256,
        );
      });
    }
    assert.ok(
      !existsSync(join(output, "metadata.json")) &&
        !existsSync(join(output, "snapshots")),
    );
  }
  assert.equal(f.tip(), revision);
  assert.deepEqual(f.git("archive", revision), archiveBytes);
});
