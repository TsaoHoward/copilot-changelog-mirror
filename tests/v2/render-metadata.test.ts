import assert from "node:assert/strict";
import { test } from "node:test";

import { savedNormalization } from "./normalization-support.js";
const script = (record: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(record)}</script>`;

test("equivalent associated Article, TechArticle, BlogPosting and WebPage dates normalize to one UTC instant", async (t) => {
  const source = "https://github.blog/changelog/article/";
  const html =
    script({
      "@graph": [
        {
          "@type": ["Thing", "TechArticle"],
          url: source,
          datePublished: "2026-10-01T20:30:00+08:00",
        },
        {
          "@type": "BlogPosting",
          mainEntityOfPage: { "@id": source + "#webpage" },
          datePublished: "2026-10-01T12:30:00Z",
        },
        {
          "@type": "WebPage",
          "@id": source.slice(0, -1) + "#webpage",
          datePublished: "2026-10-01T07:30:00-05:00",
        },
        {
          "@type": "Article",
          url: "https://example.test/unrelated",
          datePublished: "2020-01-01T00:00:00Z",
        },
        {
          "@type": "Person",
          url: source,
          datePublished: "2020-01-01T00:00:00Z",
        },
        { "@type": "WebPage", url: "", datePublished: "2020-01-01T00:00:00Z" },
        {
          "@type": "Article",
          "@id": " ",
          datePublished: "2020-01-01T00:00:00Z",
        },
        {
          "@type": "BlogPosting",
          mainEntityOfPage: { "@id": "" },
          datePublished: "2020-01-01T00:00:00Z",
        },
      ],
    }) + "<article><h1>HTML title</h1><p>Article body.</p></article>";
  const result = savedNormalization(html);
  assert.deepEqual(result.canonical, {
    title: "HTML title",
    published_at: "2026-10-01T12:30:00.000Z",
    publication_path: "/posts/article/",
  });
});

test("metadata fallback ignores malformed, invalid, unrelated and modified-only structured dates", async (t) => {
  const source = "https://github.blog/changelog/article/";
  const cases: unknown[] = [
    { "@type": "Article", url: source, dateModified: "2026-10-01T12:00:00Z" },
    {
      "@type": "WebPage",
      url: "https://example.test/unrelated",
      datePublished: "2026-10-01T12:00:00Z",
    },
    { "@type": "Article", url: source, datePublished: "2026-02-30T12:00:00Z" },
    { "@type": "Article", url: source, datePublished: "2026-10-01" },
    { "@type": "Article", url: source, datePublished: "2026-10-01T12:00:00" },
    { "@type": "Article", url: source, datePublished: "not a date" },
    { "@type": "Article", url: "", datePublished: "2026-10-01T12:00:00Z" },
    { "@type": "WebPage", "@id": "  ", datePublished: "2026-10-01T12:00:00Z" },
  ];
  for (const time of ["2026-09-01T00:00:00.000Z", null]) {
    await t.test(`discovery time ${time}`, async (t) => {
      const html =
        script(cases) +
        '<script type="application/ld+json">{bad json</script><title>Browser suffix</title><article><p>Still a usable body.</p></article>';
      const result = savedNormalization(
        html,
        source,
        "  Saved fallback  ",
        time,
      );
      assert.equal(result.canonical.title, "Saved fallback");
      assert.equal(result.canonical.published_at, time);
    });
  }
  const result = savedNormalization(
    "<article><p>Usable body.</p></article>",
    source,
    "  ",
    null,
  );
  assert.equal(result.canonical.title, source);
});
