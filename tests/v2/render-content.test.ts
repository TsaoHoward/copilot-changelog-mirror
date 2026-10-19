import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import { root } from "./support.js";
import { savedNormalization } from "./normalization-support.js";

test("offline content conversion preserves code, relative media, useful TOC and punctuation/emoji section links", async (t) => {
  const source = "https://github.blog/changelog/copilot-debugging-fixture/";
  const fixture = readFileSync(
    join(root, "tests/fixtures/github_changelog_article.html"),
    "utf8",
  );
  const html = fixture.replace(
    "</article>",
    '<p>Shared organization and enterprise skills remain useful.</p><h2>Share your feedback</h2><p>Use <code>value_1 * 2</code> inline.</p><img hidden src="/hidden.png"><img aria-hidden="true" src="/decorative.png"><img src="data:image/svg+xml,placeholder"><img src="/placeholder.svg"><video src="/demo.mp4" poster="/poster.png"><source src="/demo.webm"></video><iframe src="/embed/demo"></iframe></article>',
  );
  const { canonical, body } = savedNormalization(html, source);
  assert.equal(canonical.title, "Improved debugging with Copilot Chat");
  assert.ok(!body.includes("# Improved debugging"));
  assert.equal(body.match(/Table of Contents/g)?.length, 1);
  assert.ok(
    body.includes("Shared organization and enterprise skills remain useful."),
  );
  assert.ok(body.includes("Share your feedback"));
  assert.match(
    body,
    /```python\ndef first_frame\(lines\):\n    return next\(iter\(lines\), None\)\n```/,
  );
  assert.ok(body.includes("`value_1 * 2`"));
  assert.ok(body.includes("**clearer debugging steps**"));
  assert.ok(
    body.endsWith("\n") && !body.endsWith("\n\n") && !body.includes("\r"),
  );
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.deepEqual(
    $("img")
      .toArray()
      .map((i) => $(i).attr("src")),
    ["https://github.blog/wp-content/uploads/debugging.png"],
  );
  assert.equal($("video").attr("src"), "https://github.blog/demo.mp4");
  assert.equal($("video").attr("poster"), "https://github.blog/poster.png");
  assert.equal($("source").attr("src"), "https://github.blog/demo.webm");
  assert.equal($("iframe").attr("src"), "https://github.blog/embed/demo");
  const expected = [
    "What changed?",
    "🚀 Try it out + share feedback",
    "What changed again?",
  ];
  $("a[href^='#']").each((i, link) => {
    assert.equal($(link).text(), expected[i]);
    const anchor = $(`[id='${$(link).attr("href")!.slice(1)}']`);
    assert.equal(anchor.length, 1);
    const heading = anchor.parent().nextAll("h2").first().text();
    assert.equal(heading, i === 1 ? expected[1] : expected[0]);
  });
  assert.equal($("a[href^='#']").length, 3);
  for (const chrome of [
    "Copied",
    "Back to changelog",
    "Menu. Currently selected",
    "Improvement",
  ])
    assert.ok(!$.root().text().includes(chrome));
});

test("a usable article H1 wins over page chrome and blank editorial H1 uses a usable page H1", async (t) => {
  for (const title of ["Editorial title", ""]) {
    await t.test(title || "blank", async (t) => {
      const { canonical, body } = savedNormalization(
        `<h1>Page fallback</h1><article><h1>${title}</h1><p>Body.</p></article>`,
      );
      assert.equal(canonical.title, title || "Page fallback");
      assert.equal(body, "Body.\n");
    });
  }
});

test("saved production table becomes a GFM table with its original cell mapping", () => {
  const html = readFileSync(
    join(root, "tests/fixtures/tables/model-deprecation.html"),
    "utf8",
  );
  const { body } = savedNormalization(html);
  assert.match(
    body,
    /\| Model \| Deprecation date \| Suggested alternative \|/,
  );
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.deepEqual(
    $("table tr")
      .toArray()
      .map((row) =>
        $(row)
          .children()
          .toArray()
          .map((cell) => $(cell).text()),
      ),
    [
      ["Model", "Deprecation date", "Suggested alternative"],
      ["Claude Opus 4.8*", "2026-11-16", "Claude Opus 5.5"],
      ["Claude Opus 5", "2026-11-16", "Claude Opus 5.5"],
      ["GPT-5.6 Terra", "2026-11-16", "GPT-6.1 Sol or GPT-6 Luna"],
    ],
  );
});

test("pipe cells preserve inline meaning, punctuation, empty cells and alignment", () => {
  const { body } = savedNormalization(`<article><table>
    <tr><th align="left">Name</th><th style="text-align: right">Value</th><th>Empty</th></tr>
    <tr><td align="left"><a href="/docs?a=1&amp;b=2" title="Read">Élan | docs</a> <em>try</em> <strong>now</strong></td><td align="right"><code>a|b</code> &lt;span&gt; &amp; &#92; | *</td><td></td></tr>
    </table></article>`);
  assert.ok(!body.includes("<table"));
  assert.match(body, /\| :--- \| ---: \| --- \|/);
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.deepEqual(
    $("td")
      .toArray()
      .map((cell) => $(cell).text()),
    ["Élan | docs try now", "a|b <span> & \\ | *", ""],
  );
  assert.equal($("a").attr("href"), "https://github.blog/docs?a=1&b=2");
  assert.equal($("a").attr("title"), "Read");
  assert.equal($("em").text(), "try");
  assert.equal($("strong").text(), "now");
  assert.equal($("code").text(), "a|b");
});

test("tables outside the lossless GFM subset retain complete processed HTML", async (t) => {
  for (const [name, table] of Object.entries({
    merged:
      '<table><tr><th colspan="2">Group</th></tr><tr><td rowspan="2">One</td><td>A</td></tr><tr><td>B</td></tr></table>',
    caption:
      "<table><caption>Capacity</caption><tr><th>Name</th></tr><tr><td>A</td></tr></table>",
    headerless: "<table><tr><td>A</td><td></td></tr></table>",
    empty: "<table><tr><td></td><td></td></tr></table>",
    rowHeader:
      '<table><tr><th>Name</th><th>Value</th></tr><tr><th scope="row">A</th><td>B</td></tr></table>',
    associations:
      '<table><tr><th id="model" scope="col">Name</th></tr><tr><td headers="model"><a href="#model">A</a></td></tr></table>',
    extraHeader:
      "<table><thead><tr><th>A</th></tr><tr><th>B</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>",
    ragged: "<table><tr><th>A</th><th>B</th></tr><tr><td>C</td></tr></table>",
    footer:
      "<table><tr><th>A</th></tr><tfoot><tr><td>Total</td></tr></tfoot></table>",
    nested:
      "<table><tr><th>A</th></tr><tr><td><table><tr><td>Nested</td></tr></table></td></tr></table>",
    breaks:
      "<table><tr><th>A</th></tr><tr><td>First<br>Second</td></tr></table>",
    blocks:
      "<table><tr><th>A</th></tr><tr><td><p>First</p><ul><li>Second</li></ul><pre>line 1\n\nline 3</pre></td></tr></table>",
    unsupportedInline:
      "<table><tr><th>A</th></tr><tr><td><del>Old</del> <sub>2</sub></td></tr></table>",
    codeBreak:
      "<table><tr><th>A</th></tr><tr><td><code>first\nsecond</code></td></tr></table>",
    mixedAlignment:
      '<table><tr><th align="left">A</th></tr><tr><td align="right">B</td></tr></table>',
    conflictingAlignment:
      '<table><tr><th align="left" style="text-align: right">A</th></tr><tr><td align="left">B</td></tr></table>',
    rowGroups:
      "<table><tr><th>A</th></tr><tbody><tr><td>Group 1</td></tr></tbody><tbody><tr><td>Group 2</td></tr></tbody></table>",
  })) {
    await t.test(name, () => {
      const { body } = savedNormalization(
        `<article><p>Before</p>${table}<p>After</p></article>`,
      );
      assert.match(body, /<table[ >]/);
      const $ = load(new MarkdownIt({ html: true }).render(body));
      const expected = load(table);
      // Compare table semantics rather than incidental HTML serialization.
      const semantics = (page: ReturnType<typeof load>) =>
        page("table,caption,thead,tbody,tfoot,tr,th,td,br,p,li,pre,del,sub,a")
          .filter((_, el) => page(el).closest("table").length > 0)
          .toArray()
          .map((el) => ({
            tag: el.tagName,
            attributes: [
              "rowspan",
              "colspan",
              "scope",
              "headers",
              "id",
              "href",
            ].map((key) => page(el).attr(key) ?? null),
            text: page(el).is("pre")
              ? page(el).text()
              : page(el).text().replace(/\s+/g, " ").trim(),
          }));
      assert.deepEqual(semantics($), semantics(expected));
      assert.equal($("body > p").first().text(), "Before");
      assert.equal($("body > p").last().text(), "After");
    });
  }
});

test("fallback tables undergo the same editorial cleanup and URL/heading normalization", () => {
  const { body } = savedNormalization(`<article><h2 id="details">Details</h2>
    <table><caption>Links</caption><tr><td><a href="#details">Section</a><a href="../other/">Other</a><img src="/image.png"><script>bad()</script><span hidden>chrome</span></td></tr></table></article>`);
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.equal($("table a").first().attr("href"), "#archive-heading-1");
  assert.equal(
    $("table a").last().attr("href"),
    "https://github.blog/changelog/other/",
  );
  assert.equal($("table img").attr("src"), "https://github.blog/image.png");
  assert.equal($("script,[hidden]").length, 0);
});

test("headings inside complex tables keep usable canonical fragment links", () => {
  const { body } = savedNormalization(
    '<article><a href="#note">Outside</a><table><tr><td><h3 id="note">Note</h3><a href="#note">Inside</a></td></tr></table></article>',
  );
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.equal($("h3").attr("id"), "archive-heading-1");
  assert.deepEqual(
    $("a[href]")
      .toArray()
      .map((a) => $(a).attr("href")),
    ["#archive-heading-1", "#archive-heading-1"],
  );
});

test("GFM inline code retains meaningful repeated spaces and escaped delimiters", () => {
  const { body } = savedNormalization(
    "<article><table><tr><th>Code</th></tr><tr><td><code>a  b `c` | d</code></td></tr></table></article>",
  );
  const $ = load(new MarkdownIt({ html: true }).render(body));
  assert.equal($("td code").text(), "a  b `c` | d");
});
