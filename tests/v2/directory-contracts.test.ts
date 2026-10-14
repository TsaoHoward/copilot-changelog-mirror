import assert from "node:assert/strict";
import { test } from "node:test";
import { acquire, discover } from "../../src/v2/discovery.js";
import { captureBatch } from "../../src/v2/capture-batch.js";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
  updateRender,
} from "../../src/v2/domain.js";
import { validateDirectoryArchive } from "../../src/v2/directory-archive.js";
import { serve } from "./support.js";

test("cheap RSS/Atom discovery contracts normalize duplicates and dates, ignore updates and reject conflicting or unsafe feeds", () => {
  const base = "https://example.invalid/feed";
  const rss = Buffer.from(
    `<rss><channel><item><link>/release#one</link><title>Release</title><pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate></item><item><link>/release#two</link><title>Release</title><pubDate>2026-10-01T08:00:00+08:00</pubDate></item><item><link>/other</link><updated>2026-10-02T00:00:00Z</updated></item></channel></rss>`,
  );
  assert.deepEqual(discover(rss, base), [
    {
      source_url: "https://example.invalid/other",
      title: "https://example.invalid/other",
      published_at: null,
    },
    {
      source_url: "https://example.invalid/release",
      title: "Release",
      published_at: "2026-10-01T00:00:00.000Z",
    },
  ]);
  assert.deepEqual(
    discover(
      Buffer.from(
        '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom</title><link rel="self" href="/self"/><link rel="alternate" href="/atom#part"/><published>invalid</published><updated>2026-10-01T00:00:00Z</updated></entry></feed>',
      ),
      base,
    ),
    [
      {
        source_url: "https://example.invalid/atom",
        title: "Atom",
        published_at: null,
      },
    ],
  );
  assert.throws(
    () =>
      discover(
        Buffer.from(
          rss
            .toString()
            .replace("<title>Release</title>", "<title>Conflicting</title>"),
        ),
        base,
      ),
    /Conflicting duplicate/,
  );
  for (const xml of [
    "<rss>",
    "<!DOCTYPE rss><rss><channel/></rss>",
    "<html/>",
    "<rss/>",
    "<rss><channel/><channel/></rss>",
  ])
    assert.throws(
      () => discover(Buffer.from(xml), base),
      /XML|DOCTYPE|discovery|RSS/,
    );
});

test("cheap acquisition preserves redirect bytes and rejects HTTP, timeout, truncation and unsafe redirects", async (t) => {
  const bytes = Buffer.from([255, 0, 13, 10, 228, 184, 173]);
  const base = await serve(t, (req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/bytes" });
      res.end();
    } else if (req.url === "/bytes") res.end(bytes);
    else if (req.url === "/unsafe") {
      res.writeHead(302, { location: "file:///etc/passwd" });
      res.end();
    } else if (req.url === "/malformed") {
      res.writeHead(302, { location: "http://[" });
      res.end();
    } else if (req.url === "/loop") {
      res.writeHead(302, { location: "/loop" });
      res.end();
    } else if (req.url === "/truncated") {
      res.writeHead(200, { "content-length": 100, connection: "close" });
      res.end("short");
    } else if (req.url === "/timeout") {
      res.writeHead(200);
      res.write("incomplete");
    } else {
      res.writeHead(503);
      res.end();
    }
  });
  assert.deepEqual(await acquire(`${base}/redirect`, 1000), bytes);
  for (const [path, match] of [
    ["/error", /HTTP 503/],
    ["/unsafe", /HTTP\(S\)/],
    ["/malformed", /Invalid URL/],
    ["/loop", /Too many/],
    ["/truncated", /aborted|reset|socket/i],
    ["/timeout", /timed out/],
  ] as const)
    await assert.rejects(
      acquire(base + path, path === "/timeout" ? 50 : 1000),
      match,
    );
});

test("directory candidate contracts reject snapshot joins, unsafe objects and all routes including null canonical state without Git", () => {
  const html = Buffer.from("<article><p>Saved.</p></article>");
  const manifest = updateCapture(
    emptyManifest(),
    "https://example.invalid/release.html",
    {
      snapshot_sha256: sha256(html),
      observed_at: "2026-10-01T00:00:00.000Z",
      discovery_title: "Release",
      discovery_published_at: null,
    },
  );
  const id = Object.keys(manifest.articles)[0]!;
  const snapshot = `snapshots/${id}.html`;
  const files = new Map([
    [
      "metadata.json",
      { mode: "100644", bytes: Buffer.from(serializeManifest(manifest)) },
    ],
    [snapshot, { mode: "100644", bytes: html }],
  ]);
  assert.doesNotThrow(() => validateDirectoryArchive({ manifest, files }));
  const missing = new Map(files);
  missing.delete(snapshot);
  assert.throws(
    () => validateDirectoryArchive({ manifest, files: missing }),
    /Missing referenced snapshot/,
  );
  const badHash = new Map(files);
  badHash.set(snapshot, { mode: "100644", bytes: Buffer.from("changed") });
  assert.throws(
    () => validateDirectoryArchive({ manifest, files: badHash }),
    /hash mismatch/,
  );
  for (const path of [
    "../escape",
    "posts/../../escape",
    "app.txt",
    "snapshots/legacy.json",
  ]) {
    const unsafe = new Map(files);
    unsafe.set(path, { mode: "100644", bytes: html });
    assert.throws(
      () => validateDirectoryArchive({ manifest, files: unsafe }),
      /Invalid v2 archive object/,
    );
  }
  for (const mode of ["120000", "160000", "040000"]) {
    const unsafe = new Map(files);
    unsafe.set(snapshot, { mode, bytes: html });
    assert.throws(
      () => validateDirectoryArchive({ manifest, files: unsafe }),
      /regular file/,
    );
  }
  const frontmatter = new Map(files);
  frontmatter.set(`posts/${id}.md`, {
    mode: "100644",
    bytes: Buffer.from("---\ntitle: Legacy\n---\nBody"),
  });
  assert.throws(
    () => validateDirectoryArchive({ manifest, files: frontmatter }),
    /front matter/,
  );
  const collision = updateCapture(
    manifest,
    "https://other.invalid/release.html",
    manifest.articles[id]!.capture,
  );
  const all = new Map(files);
  const other = Object.keys(collision.articles).find((key) => key !== id)!;
  all.set(`snapshots/${other}.html`, { mode: "100644", bytes: html });
  all.set("metadata.json", {
    mode: "100644",
    bytes: Buffer.from(serializeManifest(collision)),
  });
  assert.throws(
    () => validateDirectoryArchive({ manifest: collision, files: all }),
    /route collision/,
  );
  const wrong = updateRender(manifest, id, {
    title: "Release",
    published_at: null,
    publication_path: "/posts/renamed/",
  });
  const wrongFiles = new Map(files);
  wrongFiles.set("metadata.json", {
    mode: "100644",
    bytes: Buffer.from(serializeManifest(wrong)),
  });
  assert.throws(
    () => validateDirectoryArchive({ manifest: wrong, files: wrongFiles }),
    /Source-derived route mismatch/,
  );
});

test("discovery-only capture preserves observation time, canonical state, bodies and articles absent from discovery", async (t) => {
  const bytes = Buffer.from("<article><p>Original.</p></article>");
  let title = "First";
  let html = bytes;
  const base = await serve(t, (req, res) =>
    req.url === "/feed"
      ? res.end(
          `<rss><channel><item><link>/release</link><title>${title}</title></item></channel></rss>`,
        )
      : res.end(html),
  );
  const first = await captureBatch(
    { manifest: emptyManifest(), files: new Map() },
    { feedUrl: base + "/feed", now: () => new Date("2026-10-01T00:00:00Z") },
  );
  const id = Object.keys(first.manifest.articles)[0]!;
  let manifest = updateRender(first.manifest, id, {
    title: "Canonical",
    published_at: null,
    publication_path: "/posts/release/",
  });
  manifest = updateCapture(manifest, "https://example.invalid/retained", {
    snapshot_sha256: sha256("older"),
    observed_at: "2026-09-01T00:00:00.000Z",
    discovery_title: "Older",
    discovery_published_at: null,
  });
  const old = Object.keys(manifest.articles).find((key) => key !== id)!;
  const files = new Map(first.files);
  files.set("metadata.json", {
    mode: "100644",
    bytes: Buffer.from(serializeManifest(manifest)),
  });
  files.set(`posts/${id}.md`, {
    mode: "100644",
    bytes: Buffer.from("Existing body.\n"),
  });
  files.set(`snapshots/${old}.html`, {
    mode: "100644",
    bytes: Buffer.from("older"),
  });
  title = "New discovery";
  const second = await captureBatch(
    { manifest, files },
    { feedUrl: base + "/feed", now: () => new Date("2026-10-14T00:00:00Z") },
  );
  assert.equal(
    second.manifest.articles[id]!.capture.observed_at,
    "2026-10-01T00:00:00.000Z",
  );
  assert.equal(second.manifest.articles[id]!.capture.discovery_title, title);
  assert.deepEqual(
    second.manifest.articles[id]!.canonical,
    manifest.articles[id]!.canonical,
  );
  assert.deepEqual(second.manifest.articles[old], manifest.articles[old]);
  assert.deepEqual(
    second.files.get(`posts/${id}.md`),
    files.get(`posts/${id}.md`),
  );
  const third = await captureBatch(second, { feedUrl: base + "/feed" });
  assert.equal(third.changed, false);
  assert.deepEqual(third.files, second.files);
  html = Buffer.from("new raw bytes");
  const fourth = await captureBatch(third, {
    feedUrl: base + "/feed",
    now: () => new Date("2026-10-14T00:00:00Z"),
  });
  assert.equal(
    fourth.manifest.articles[id]!.capture.observed_at,
    "2026-10-14T00:00:00.000Z",
  );
});
