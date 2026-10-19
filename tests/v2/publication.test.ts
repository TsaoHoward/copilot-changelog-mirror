import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleIdentity,
  publicationPath,
  publicationProjection,
  emptyManifest,
  updateCapture,
  updateRender,
} from "../../src/v2/domain.js";

test("public source-slug routes remain separate from internal URL-hash identities", () => {
  assert.equal(
    publicationPath(
      "HTTPS://EXAMPLE.TEST:443/Release.html?source=feed#section",
    ),
    "/posts/release/",
  );
  assert.equal(publicationPath("https://example.test/"), "/posts/article/");
  assert.equal(
    publicationPath("https://example.test/%E4%B8%AD.html"),
    "/posts/article/",
  );
  assert.equal(publicationPath("https://example.test/a/same/"), "/posts/same/");
  assert.equal(publicationPath("https://example.test/b/same/"), "/posts/same/");
  assert.notEqual(
    articleIdentity("https://example.test/a/same/").article_id,
    articleIdentity("https://example.test/b/same/").article_id,
  );
});

test("canonical projection contains only complete reader content, preserving stable routes across title/date changes", () => {
  const source = "https://example.test/article/";
  let manifest = updateCapture(emptyManifest(), source, {
    snapshot_sha256: "a".repeat(64),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: "Unselected feed title",
    discovery_published_at: null,
  });
  const id = articleIdentity(source).article_id;
  const bodies = new Map([[id, "Saved body.\n"]]);
  assert.equal(publicationProjection(manifest, bodies), null);
  manifest = updateRender(manifest, id, {
    title: "Canonical title",
    published_at: null,
    publication_path: "/posts/article/",
  });
  assert.deepEqual(publicationProjection(manifest, bodies), [
    {
      article_id: id,
      source_url: source,
      title: "Canonical title",
      published_at: null,
      publication_path: "/posts/article/",
      body: "Saved body.\n",
    },
  ]);
  const observed = updateCapture(manifest, source, {
    ...manifest.articles[id]!.capture,
    snapshot_sha256: "b".repeat(64),
    observed_at: "2026-10-02T00:00:00.000Z",
    discovery_title: "Other feed title",
  });
  assert.deepEqual(
    publicationProjection(observed, bodies),
    publicationProjection(manifest, bodies),
  );
  const changed = updateRender(observed, id, {
    title: "Edited title",
    published_at: "2026-10-03T00:00:00.000Z",
    publication_path: "/posts/article/",
  });
  assert.deepEqual(
    publicationProjection(changed, new Map([[id, "Edited body.\n"]])),
    [
      {
        article_id: id,
        source_url: source,
        title: "Edited title",
        published_at: "2026-10-03T00:00:00.000Z",
        publication_path: "/posts/article/",
        body: "Edited body.\n",
      },
    ],
  );
  assert.equal(publicationProjection(changed, new Map()), null);
  assert.deepEqual(publicationProjection(emptyManifest(), new Map()), []);
});
