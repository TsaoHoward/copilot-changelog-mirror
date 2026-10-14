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
  return normalizeArticle(bytes, saved(bytes, source, title, time).article, {
    requireEditorialRoot: true,
  });
}

test("minimal authentic nested editorial roots retain skills, feedback, ordered lists, emphasis, anchors and meaningful media", () => {
  const weekly = convert(
    readFileSync(join(root, "tests/fixtures/minimal/weekly-skills.html")),
  );
  assert.equal(
    weekly.canonical.title,
    "GitHub Copilot weekly releases — September 21",
  );
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
  );
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
  );
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
  const first = renderBatch(input, true);
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
  const second = renderBatch({ manifest, files }, true);
  assert.equal(second.changed, false);
  assert.deepEqual(second.manifest, manifest);
  assert.deepEqual(second.files, files);
  files.delete(`posts/${input.article.article_id}.md`);
  const repair = renderBatch({ manifest, files }, true);
  assert.equal(repair.changed, true);
  assert.equal(
    repair.files.get(`posts/${input.article.article_id}.md`)!.bytes.toString(),
    "Body.\n",
  );
});
