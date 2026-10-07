import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import { Fixture, root, seedArticle } from "./support.js";

test("offline content conversion preserves code, relative media, useful TOC and punctuation/emoji section links", async (t) => {
  const f = new Fixture(t);
  const source = "https://github.blog/changelog/copilot-debugging-fixture/";
  const fixture = readFileSync(
    join(root, "tests/fixtures/github_changelog_article.html"),
    "utf8",
  );
  const html = fixture.replace(
    "</article>",
    '<p>Shared organization and enterprise skills remain useful.</p><h2>Share your feedback</h2><p>Use <code>value_1 * 2</code> inline.</p><img hidden src="/hidden.png"><img aria-hidden="true" src="/decorative.png"><img src="data:image/svg+xml,placeholder"><img src="/placeholder.svg"><video src="/demo.mp4" poster="/poster.png"><source src="/demo.webm"></video><iframe src="/embed/demo"></iframe></article>',
  );
  const id = seedArticle(f, html, source);
  const result = await f.render();
  assert.equal(result.code, 0, result.stderr);
  const body = f.git("show", `${f.branch}:posts/${id}.md`).toString();
  assert.equal(
    f.manifest().articles[id].canonical.title,
    "Improved debugging with Copilot Chat",
  );
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
      const f = new Fixture(t);
      const id = seedArticle(
        f,
        `<h1>Page fallback</h1><article><h1>${title}</h1><p>Body.</p></article>`,
      );
      const result = await f.render();
      assert.equal(result.code, 0, result.stderr);
      assert.equal(
        f.manifest().articles[id].canonical.title,
        title || "Page fallback",
      );
      assert.equal(
        f.git("show", `${f.branch}:posts/${id}.md`).toString(),
        "Body.\n",
      );
    });
  }
});
