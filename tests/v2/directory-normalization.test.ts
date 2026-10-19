import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import {
  emptyManifest,
  updateCapture,
  sha256,
  serializeManifest,
} from "../../src/v2/domain.js";
import { normalizeArticle } from "../../src/v2/normalize.js";
import { renderBatch } from "../../src/v2/render-batch.js";
import { root } from "./support.js";

function saved(
  bytes: Buffer,
  source = "https://github.blog/changelog/release/",
  title = "Fallback",
  time: string | null = null,
) {
  const manifest = updateCapture(emptyManifest(), source, {
    snapshot_sha256: sha256(bytes),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: title,
    discovery_published_at: time,
  });
  const article = Object.values(manifest.articles)[0]!;
  return {
    manifest,
    article,
    files: new Map([
      [
        "metadata.json",
        { mode: "100644", bytes: Buffer.from(serializeManifest(manifest)) },
      ],
      [`snapshots/${article.article_id}.html`, { mode: "100644", bytes }],
    ]),
  };
}
function convert(
  bytes: Buffer,
  source?: string,
  title?: string,
  time?: string | null,
) {
  return normalizeArticle(bytes, saved(bytes, source, title, time).article);
}

test("minimal authentic nested editorial roots retain skills, feedback, ordered lists, emphasis, anchors and meaningful media", () => {
  const weekly = convert(
    readFileSync(join(root, "tests/fixtures/minimal/weekly-skills.html")),
    "https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/",
  );
  assert.equal(
    weekly.canonical.title,
    "GitHub Copilot weekly releases — September 21",
  );
  assert.equal(weekly.canonical.published_at, "2026-09-25T16:42:48.000Z");
  const $ = load(new MarkdownIt({ html: true }).render(weekly.body));
  assert.equal($("li").length, 3);
  assert.match(
    $("li").last().text(),
    /^Shared organization and enterprise skills, along with organization-managed custom instructions, now work in local and Copilot agent sessions\.$/,
  );
  assert.equal($("h3").text(), "GitHub Copilot in JetBrains");
  assert.equal($("a[href^='#']").length, 1);
  assert.equal(
    $(`[id='${$("a[href^='#']").attr("href")!.slice(1)}']`).length,
    1,
  );
  assert.equal($("img").length, 1);
  assert.match($("img").attr("alt")!, /Weekly releases/);
  assert.ok(!weekly.body.includes("Table of Contents"));
  const feedback = convert(
    readFileSync(join(root, "tests/fixtures/minimal/feedback-video.html")),
    "https://github.blog/changelog/2026-09-29-gpt-6-1-sol-in-github-copilot/",
  );
  assert.equal(feedback.canonical.published_at, "2026-09-29T17:02:27.000Z");
  assert.ok(
    feedback.body.indexOf("<video") <
      feedback.body.indexOf("Share your feedback"),
  );
  assert.match(
    feedback.body,
    /\[GitHub Community\]\(https:\/\/github.com\/orgs\/community\/discussions\/categories\/copilot-conversations\)/,
  );
  const media = load(new MarkdownIt({ html: true }).render(feedback.body));
  assert.equal(
    media("video").attr("src"),
    "https://github.com/user-attachments/assets/a4b67a37-0105-4da9-b710-aa33b88cba8f",
  );
  const lists = convert(
    readFileSync(join(root, "tests/fixtures/minimal/lists-media.html")),
    "https://github.blog/changelog/2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app/",
  );
  assert.equal(lists.canonical.published_at, "2026-09-30T14:31:19.000Z");
  const parsed = load(new MarkdownIt({ html: true }).render(lists.body));
  assert.deepEqual(
    parsed("strong")
      .toArray()
      .map((el) => parsed(el).text()),
    ["Single:", "Cascade:", "Critique:"],
  );
  assert.equal(parsed("li").length, 3);
  assert.equal(parsed("img[aria-hidden='true'],svg").length, 0);
  assert.ok(
    lists.body.indexOf("research preview") < lists.body.indexOf("**Single:**"),
  );
});

test("strict directory normalization rejects unsupported layouts and invalid saved UTF-8", () => {
  assert.throws(
    () =>
      convert(
        Buffer.from("<body><nav>Menu</nav><p>Unknown chrome.</p></body>"),
      ),
    /Unsupported editorial layout/,
  );
  assert.throws(() => convert(Buffer.from([255])), /encoded data/);
});

test("raw-only chrome and unused observations leave canonical bodies unchanged; missing derived bodies regenerate", () => {
  const input = saved(
    Buffer.from("<article><h1>Saved title</h1><p>Body.</p></article>"),
  );
  const first = renderBatch(input);
  const changedRaw = Buffer.from(
    "<article><h1>Saved title</h1><p>Body.</p><nav>New chrome</nav></article>",
  );
  const manifest = updateCapture(first.manifest, input.article.source_url, {
    ...input.article.capture,
    snapshot_sha256: sha256(changedRaw),
    observed_at: "2026-10-02T00:00:00.000Z",
    discovery_title: "Unused fallback",
  });
  const files = new Map(first.files);
  files.set(`snapshots/${input.article.article_id}.html`, {
    mode: "100644",
    bytes: changedRaw,
  });
  files.set("metadata.json", {
    mode: "100644",
    bytes: Buffer.from(serializeManifest(manifest)),
  });
  const second = renderBatch({ manifest, files });
  assert.equal(second.changed, false);
  assert.deepEqual(second.manifest, manifest);
  assert.deepEqual(second.files, files);
  files.delete(`posts/${input.article.article_id}.md`);
  const repair = renderBatch({ manifest, files });
  assert.equal(repair.changed, true);
  assert.equal(
    repair.files.get(`posts/${input.article.article_id}.md`)!.bytes.toString(),
    "Body.\n",
  );
});

test("selected title, body, date and discovery fallbacks change canonical content without renaming source routes", () => {
  const source = "https://github.blog/changelog/release/";
  const html = (title: string, body: string, date: string) =>
    Buffer.from(
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Article", url: source, datePublished: date })}</script><article><h1>${title}</h1><p>${body}</p></article>`,
    );
  const first = convert(html("Title", "Body.", "2026-10-01T00:00:00Z"), source);
  assert.deepEqual(first, {
    canonical: {
      title: "Title",
      published_at: "2026-10-01T00:00:00.000Z",
      publication_path: "/posts/release/",
    },
    body: "Body.\n",
  });
  const edited = convert(
    html("Edited title", "Edited body.", "2026-10-02T00:00:00Z"),
    source,
  );
  assert.deepEqual(edited, {
    canonical: {
      title: "Edited title",
      published_at: "2026-10-02T00:00:00.000Z",
      publication_path: "/posts/release/",
    },
    body: "Edited body.\n",
  });
  const fallback = convert(
    Buffer.from("<article><p>Body.</p></article>"),
    source,
    "Changed fallback",
    "2026-10-03T00:00:00.000Z",
  );
  assert.deepEqual(fallback.canonical, {
    title: "Changed fallback",
    published_at: "2026-10-03T00:00:00.000Z",
    publication_path: "/posts/release/",
  });
});

test("late conflicting dates and unusable bodies reject the complete Render batch without mutating saved input", () => {
  const source = "https://github.blog/changelog/zzz-invalid/";
  for (const bad of [
    `<script type="application/ld+json">${JSON.stringify([
      {
        "@type": "Article",
        url: source,
        datePublished: "2026-10-01T12:00:00Z",
      },
      {
        "@type": "TechArticle",
        mainEntityOfPage: source,
        datePublished: "2026-10-02T12:00:00Z",
      },
    ])}</script><article><p>Body.</p></article>`,
    "",
    "<article><h1>Only a title</h1><script>chrome</script></article>",
    Buffer.from([255]),
  ]) {
    const good = saved(
      Buffer.from("<article><p>First valid body.</p></article>"),
      "https://github.blog/changelog/aaa-valid/",
    );
    const raw = Buffer.from(bad);
    const manifest = updateCapture(good.manifest, source, {
      snapshot_sha256: sha256(raw),
      observed_at: "2026-10-01T00:00:00.000Z",
      discovery_title: "Invalid",
      discovery_published_at: null,
    });
    const id = Object.keys(manifest.articles).find(
      (id) => id !== good.article.article_id,
    )!;
    const files = new Map(good.files);
    files.set(`snapshots/${id}.html`, { mode: "100644", bytes: raw });
    files.set("metadata.json", {
      mode: "100644",
      bytes: Buffer.from(serializeManifest(manifest)),
    });
    const before = {
      manifest: JSON.stringify(manifest),
      files: [...files].map(([path, file]) => [
        path,
        file.bytes.toString("hex"),
      ]),
    };
    assert.throws(
      () => renderBatch({ manifest, files }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(id));
        if (String(bad).includes("datePublished"))
          assert.match(
            error.message,
            /Conflicting.*2026-10-01T12:00:00.000Z.*2026-10-02T12:00:00.000Z/,
          );
        return true;
      },
    );
    assert.deepEqual(
      {
        manifest: JSON.stringify(manifest),
        files: [...files].map(([path, file]) => [
          path,
          file.bytes.toString("hex"),
        ]),
      },
      before,
    );
  }
});
