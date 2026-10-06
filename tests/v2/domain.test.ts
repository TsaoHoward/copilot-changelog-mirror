import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleIdentity,
  emptyManifest,
  updateCapture,
  serializeManifest,
  readManifest,
  updateRender,
  validateTransition,
  validateArchive,
} from "../../src/v2/domain.js";

test("a capture creates a joined identity and deterministic manifest without canonical state", () => {
  const identity = articleIdentity(
    "HTTPS://EXAMPLE.COM:443/a/../release.html#section",
  );
  assert.equal(identity.source_url, "https://example.com/release.html");
  assert.match(identity.article_id, /^release-[a-f0-9]{12}$/);
  const manifest = updateCapture(emptyManifest(), identity.source_url, {
    snapshot_sha256: "a".repeat(64),
    observed_at: "2026-10-06T12:00:00.000Z",
    discovery_title: "Release",
    discovery_published_at: null,
  });
  assert.equal(manifest.articles[identity.article_id]?.canonical, null);
  assert.deepEqual(readManifest(serializeManifest(manifest)), manifest);
  assert.equal(serializeManifest(manifest).endsWith("\n"), true);
});

test("the shared API rejects corrupt schemas and duplicate JSON keys", () => {
  const valid = updateCapture(
    emptyManifest(),
    "https://example.com/release.html",
    {
      snapshot_sha256: "a".repeat(64),
      observed_at: "2026-10-06T12:00:00.000Z",
      discovery_title: "",
      discovery_published_at: null,
    },
  );
  const id = Object.keys(valid.articles)[0]!;
  const invalid = [
    "{",
    '{"schema_version":2,"schema_version":2,"articles":{}}',
    '{"schema_version":2,"\\u0073chema_version":2,"articles":{}}',
    JSON.stringify({ ...valid, schema_version: 1 }),
    JSON.stringify({ ...valid, captures: [] }),
    JSON.stringify({ ...valid, articles: [] }),
    JSON.stringify({ ...valid, articles: { renamed: valid.articles[id] } }),
    ...[
      { source_url: "HTTPS://EXAMPLE.COM/release.html" },
      { article_id: "renamed" },
      {
        canonical: {
          title: "",
          published_at: null,
          publication_path: "/posts/release/",
        },
      },
      { capture: { ...valid.articles[id]!.capture, snapshot_sha256: "bad" } },
      {
        capture: {
          ...valid.articles[id]!.capture,
          observed_at: "2026-02-30T00:00:00.000Z",
        },
      },
      {
        capture: {
          ...valid.articles[id]!.capture,
          discovery_published_at: "2026-10-06",
        },
      },
      { capture: { ...valid.articles[id]!.capture, discovery_title: null } },
    ].map((patch) =>
      JSON.stringify({
        ...valid,
        articles: { [id]: { ...valid.articles[id], ...patch } },
      }),
    ),
  ];
  for (const text of invalid)
    assert.throws(() => readManifest(text), /./, text);
});

test("stage APIs enforce ownership and immutable identities while preserving the other stage", () => {
  const source = "https://example.com/release.html";
  const observation = {
    snapshot_sha256: "a".repeat(64),
    observed_at: "2026-10-06T12:00:00.000Z",
    discovery_title: "Feed title",
    discovery_published_at: null,
  };
  const captured = updateCapture(emptyManifest(), source, observation);
  const id = Object.keys(captured.articles)[0]!;
  const canonical = {
    title: "Canonical title",
    published_at: null,
    publication_path: "/posts/release/",
  };
  const rendered = updateRender(captured, id, canonical);
  const recaptured = updateCapture(rendered, source, {
    ...observation,
    snapshot_sha256: "b".repeat(64),
  });
  assert.deepEqual(recaptured.articles[id]!.canonical, canonical);
  assert.deepEqual(rendered.articles[id]!.capture, observation);
  for (const extra of [
    { canonical },
    { article_id: "new" },
    { source_url: "https://elsewhere.test/" },
  ]) {
    assert.throws(
      () => updateCapture(rendered, source, { ...observation, ...extra }),
      /fields|ownership|identity/i,
    );
  }
  for (const extra of [
    { capture: observation },
    { source_url: source },
    { article_id: id },
  ]) {
    assert.throws(
      () => updateRender(rendered, id, { ...canonical, ...extra }),
      /fields|ownership|identity/i,
    );
  }
  assert.throws(
    () => validateTransition(rendered, captured, "capture"),
    /canonical|ownership/i,
  );
  assert.throws(
    () => validateTransition(rendered, recaptured, "render"),
    /capture|ownership/i,
  );
  assert.throws(
    () => validateTransition(rendered, emptyManifest(), "capture"),
    /delete|identity/i,
  );
});

test("equivalent maps serialize identically and meaningful source URL differences keep distinct identities", () => {
  const observation = {
    snapshot_sha256: "a".repeat(64),
    observed_at: "2026-10-06T12:00:00.000Z",
    discovery_title: "Feed title",
    discovery_published_at: null,
  };
  const urls = [
    "https://example.com/Release/",
    "https://example.com/Release",
    "https://example.com/Release?a=1&b=2",
    "https://example.com/Release?b=2&a=1",
  ];
  const forward = urls.reduce(
    (state, url) => updateCapture(state, url, observation),
    emptyManifest(),
  );
  const reverse = urls
    .toReversed()
    .reduce(
      (state, url) => updateCapture(state, url, observation),
      emptyManifest(),
    );
  assert.equal(Object.keys(forward.articles).length, 4);
  assert.equal(serializeManifest(forward), serializeManifest(reverse));
  assert.equal(
    articleIdentity("https://example.com/#fragment").article_id,
    "article-0f115db062b7",
  );
  assert.equal(
    articleIdentity("https://example.com/%E4%B8%AD.html").article_id.startsWith(
      "article-",
    ),
    true,
  );
  assert.throws(() => articleIdentity("ftp://example.com/"), /Unsupported/);
});

test("archive validation accepts regular files and Markdown rules but rejects mismatched persisted metadata", () => {
  const manifest = updateCapture(emptyManifest(), "https://example.com/", {
    snapshot_sha256:
      "0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7",
    observed_at: "2026-10-06T12:00:00.000Z",
    discovery_title: "Example",
    discovery_published_at: null,
  });
  const files = new Map([
    [
      "metadata.json",
      { mode: "100644", bytes: Buffer.from(serializeManifest(manifest)) },
    ],
    [
      "snapshots/article-0f115db062b7.html",
      { mode: "100755", bytes: Buffer.from("https://example.com/") },
    ],
    [
      "posts/article-0f115db062b7.md",
      {
        mode: "100644",
        bytes: Buffer.from("---\nAn opening horizontal rule.\n"),
      },
    ],
  ]);
  assert.doesNotThrow(() => validateArchive(manifest, files));
  files.set("metadata.json", {
    mode: "100644",
    bytes: Buffer.from(serializeManifest(emptyManifest())),
  });
  assert.throws(() => validateArchive(manifest, files), /metadata|manifest/i);
});
