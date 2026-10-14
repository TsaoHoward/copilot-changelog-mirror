import assert from "node:assert/strict";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
const text = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Static source-reviewed oracle shared with the migration-only comparison. */
export function verifyEditorialBaseline(body: string, baseline: any): void {
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
          (a) => $(a).attr("href") === new URL(link, baseline.source_url).href,
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
}
