import assert from "node:assert/strict";
import { test } from "node:test";
import { Fixture, serve } from "./support.js";

test("production HTTP transport follows redirects and preserves entity-body bytes under the discovery identity", async (t) => {
  const f = new Fixture(t);
  const bytes = Buffer.from([60, 112, 62, 255, 0, 228, 184, 173, 13, 10]);
  const base = await serve(t, (req, res) => {
    if (req.url === "/feed")
      res.end(
        "<rss><channel><item><title><![CDATA[Copilot & release]]></title><link>/old.html#article</link><pubDate>invalid</pubDate></item></channel></rss>",
      );
    else if (req.url === "/old.html") {
      res.writeHead(302, { location: "/new.html" });
      res.end();
    } else {
      res.write(bytes.subarray(0, 3));
      res.end(bytes.subarray(3));
    }
  });
  const result = await f.cli(`${base}/feed`);
  assert.equal(result.code, 0, result.stderr);
  const article = Object.values(f.manifest().articles)[0] as any;
  assert.equal(article.source_url, `${base}/old.html`);
  assert.match(article.article_id, /^old-/);
  assert.equal(article.capture.discovery_title, "Copilot & release");
  assert.equal(article.capture.discovery_published_at, null);
  assert.deepEqual(
    f.git("show", `${f.branch}:snapshots/${article.article_id}.html`),
    bytes,
  );
});

test("RSS and Atom normalize publication evidence, deduplicate equivalent discoveries and ignore update timestamps", async (t) => {
  const f = new Fixture(t);
  const source = f.source("release.html", "evidence");
  const base = await serve(t, (_req, res) => res.end("HTTP evidence"));
  const atom = f.source(
    "feed.xml",
    `<feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Release</title><link rel="self" href="${base}/self"/><link rel="alternate" href="${source}#one"/>
      <published>2026-10-06T20:30:00+08:00</published><updated>2026-10-07T00:00:00Z</updated></entry>
    <entry><title>Release</title><link href="${source}#two"/><published>2026-10-06T12:30:00Z</published></entry>
    <entry><link href="${base}/article.html"/><updated>2026-10-07T00:00:00Z</updated></entry>
    <entry><title>No link</title></entry>
  </feed>`,
  );
  const first = await f.cli(atom);
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(first.result.counts, {
    created: 2,
    updated: 0,
    unchanged: 0,
  });
  const articles = Object.values(f.manifest().articles) as any[];
  const local = articles.find((a) => a.source_url === source);
  const http = articles.find((a) => a.source_url === `${base}/article.html`);
  assert.equal(
    local.capture.discovery_published_at,
    "2026-10-06T12:30:00.000Z",
  );
  assert.equal(http.capture.discovery_published_at, null);
  assert.equal(http.capture.discovery_title, `${base}/article.html`);
  const before = f.tip();
  f.feed(`<item><link>${base}/article.html#part</link><updated>2026-10-08T00:00:00Z</updated></item>
    <item><link>${source}</link><title>Release</title><pubDate>Tue, 06 Oct 2026 12:30:00 GMT</pubDate></item>`);
  const same = await f.cli(atom);
  assert.equal(same.result.outcome, "no-change", same.stderr);
  assert.equal(f.tip(), before);
});

test("conflicting duplicate discovery observations fail before acquisition and persistence", async (t) => {
  const f = new Fixture(t);
  let requests = 0;
  const base = await serve(t, (_req, res) => {
    requests++;
    res.end("evidence");
  });
  const feed =
    f.feed(`<item><link>${base}/article#one</link><title>A</title></item>
    <item><link>${base}/article#two</link><title>B</title></item>`);
  const failed = await f.cli(feed);
  assert.equal(failed.code, 1);
  assert.equal(failed.result.outcome, "failure");
  assert.match(failed.stderr, /conflicting duplicate/i);
  assert.equal(requests, 0);
  assert.throws(() => f.tip());
});

test("invalid feeds, HTTP errors, timeouts, truncated responses and later article failures leave no partial archive", async (t) => {
  for (const existing of [false, true]) {
    await t.test(
      existing ? "existing archive" : "first bootstrap",
      async (t) => {
        const f = new Fixture(t);
        const source = f.source("original.html", "original");
        const good = f.feed(`<item><link>${source}</link></item>`);
        if (existing) assert.equal((await f.cli(good)).code, 0);
        const before = existing ? f.tip() : null;
        let successes = 0;
        const base = await serve(t, (req, res) => {
          if (req.url === "/ok") {
            successes++;
            res.end("successfully acquired");
          } else if (req.url === "/timeout") {
            res.writeHead(200);
            res.write("unfinished");
          } else if (req.url === "/truncated") {
            res.writeHead(200, { "content-length": 100 });
            res.end("short");
          } else {
            res.writeHead(503);
            res.end("unavailable");
          }
        });
        const feeds = [
          f.source("invalid.xml", "<rss><channel>"),
          f.source("unknown.xml", "<html>not a feed</html>"),
          f.source("missing-channel.xml", "<rss/>"),
          f.source(
            "unsupported.xml",
            "<rss><channel><item><link>ftp://example.com/article</link></item></channel></rss>",
          ),
          `${base}/error`,
          `${base}/timeout`,
          `${base}/truncated`,
          f.source(
            "batch.xml",
            `<rss><channel><item><link>${base}/ok</link></item><item><link>${base}/z-fails</link></item></channel></rss>`,
          ),
          f.source(
            "missing.xml",
            `<rss><channel><item><link>file://${f.sources}/not-found.html</link></item></channel></rss>`,
          ),
        ];
        for (const feed of feeds) {
          const failed = await f.cli(feed, ["--timeout-ms", "100"]);
          assert.equal(failed.code, 1, feed);
          assert.equal(failed.result.outcome, "failure");
          assert.equal(failed.result.archive_output, null);
          assert.ok(failed.stderr.trim());
          if (existing) assert.equal(f.tip(), before);
          else assert.throws(() => f.tip());
          assert.equal(f.text("status", "--porcelain"), "");
        }
        assert.equal(
          successes,
          1,
          "the batch acquired its first article before the later failure",
        );
      },
    );
  }
});

test("malformed and unsupported redirect targets return structured failure without advancing the archive", async (t) => {
  const f = new Fixture(t);
  const source = f.source("old.html", "older evidence");
  assert.equal(
    (await f.cli(f.feed(`<item><link>${source}</link></item>`))).code,
    0,
  );
  const before = f.tip();
  const base = await serve(t, (req, res) => {
    if (req.url === "/malformed") res.writeHead(302, { location: "http://[" });
    else if (req.url === "/unsupported")
      res.writeHead(302, { location: "ftp://example.com/" });
    else if (req.url === "/file") res.writeHead(302, { location: source });
    else res.writeHead(302, { location: "/loop" });
    res.end();
  });
  for (const path of ["/malformed", "/unsupported", "/file", "/loop"]) {
    const failed = await f.cli(`${base}${path}`);
    assert.equal(failed.code, 1);
    assert.equal(failed.result?.outcome, "failure", failed.stderr);
    assert.equal(failed.result.archive_output, null);
    assert.equal(f.tip(), before);
  }
});
