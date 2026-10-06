import assert from "node:assert/strict";
import { test } from "node:test";
import { Fixture } from "./support.js";

test("the explicit CLI bootstraps original bytes in one orphan archive commit and an identical rerun is a no-op", async (t) => {
  const f = new Fixture(t);
  const bytes = Buffer.from([
    60, 112, 62, 228, 184, 173, 255, 0, 13, 10, 60, 47, 112, 62,
  ]);
  const source = f.source("release.html", bytes);
  const feed = f.feed(
    `<item><title>Release</title><link>${source}</link><pubDate>Tue, 29 Sep 2026 12:30:00 GMT</pubDate></item>`,
  );
  const head = f.text("rev-parse", "HEAD");
  const first = await f.cli(feed);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(first.result.outcome, "changed");
  assert.equal(first.result.archive_input, null);
  assert.equal(first.result.archive_output, f.tip());
  assert.deepEqual(first.result.counts, {
    created: 1,
    updated: 0,
    unchanged: 0,
  });
  assert.equal(f.text("rev-list", "--count", f.branch), "1");
  const manifest = f.manifest();
  assert.equal(manifest.schema_version, 2);
  const article = Object.values(manifest.articles)[0] as any;
  assert.match(article.article_id, /^release-[a-f0-9]{12}$/);
  assert.equal(article.source_url, source);
  assert.equal(article.canonical, null);
  assert.equal(
    article.capture.discovery_published_at,
    "2026-09-29T12:30:00.000Z",
  );
  assert.match(article.capture.observed_at, /^2026-10-06T12:00:00\.000Z$/);
  assert.deepEqual(
    f.git("show", `${f.branch}:snapshots/${article.article_id}.html`),
    bytes,
  );
  assert.deepEqual(
    f.text("ls-tree", "-r", "--name-only", f.branch).split("\n"),
    ["metadata.json", `snapshots/${article.article_id}.html`],
  );
  const manifestBytes = f.git("show", `${f.branch}:metadata.json`);
  const second = await f.cli(feed, [], {
    COPILOT_CAPTURE_NOW: "2026-10-07T12:00:00.000Z",
  });
  assert.equal(second.code, 0, second.stderr);
  assert.equal(second.result.outcome, "no-change");
  assert.equal(second.result.archive_output, first.result.archive_output);
  assert.deepEqual(second.result.counts, {
    created: 0,
    updated: 0,
    unchanged: 1,
  });
  assert.deepEqual(f.git("show", `${f.branch}:metadata.json`), manifestBytes);
  assert.equal(f.text("rev-parse", "HEAD"), head);
  assert.equal(f.text("status", "--porcelain"), "");
});

test("raw and discovery changes preserve canonical state, older evidence, unrelated articles and dirty application work", async (t) => {
  const f = new Fixture(t);
  const source = f.source(
    "release.html",
    "<h1>Article</h1><footer>chrome 1</footer>",
  );
  const outside = f.source("older.html", "Older evidence");
  const items = `<item><title>Discovery</title><link>${source}</link><pubDate>2026-09-29T20:30:00+08:00</pubDate></item>`;
  const feed = f.feed(`${items}<item><link>${outside}</link></item>`);
  assert.equal((await f.cli(feed)).code, 0);
  const manifest = f.manifest();
  const article = Object.values(manifest.articles).find(
    (a: any) => a.source_url === source,
  ) as any;
  const canonical = {
    title: "Canonical title",
    published_at: "2026-09-29T12:30:00.000Z",
    publication_path: "/posts/release/",
  };
  article.canonical = canonical;
  f.seed({
    "metadata.json": JSON.stringify(manifest),
    [`posts/${article.article_id}.md`]: "Canonical **body**\n",
  });
  const before = f.tip();
  const snapshotPath = `snapshots/${article.article_id}.html`;
  const raw = f.git("show", `${f.branch}:${snapshotPath}`);
  const head = f.text("rev-parse", "HEAD");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${f.repo}/app.txt`, "staged application\n");
  f.git("add", "app.txt");
  writeFileSync(`${f.repo}/app.txt`, "unstaged application\n");
  writeFileSync(`${f.repo}/untracked.txt`, "user work\n");
  const index = f.git("diff", "--cached");
  const work = f.git("diff");
  const status = f.git("status", "--porcelain");
  // A feed window retains the article outside discovery, and equivalent dates do not churn.
  f.feed(
    items.replace("2026-09-29T20:30:00+08:00", "Tue, 29 Sep 2026 12:30:00 GMT"),
  );
  const same = await f.cli(feed);
  assert.equal(same.result.outcome, "no-change");
  assert.equal(f.tip(), before);
  f.source("release.html", "<h1>Article</h1><footer>chrome 2</footer>");
  const changed = await f.cli(feed, [], {
    COPILOT_CAPTURE_NOW: "2026-10-07T12:00:00.000Z",
  });
  assert.equal(changed.result.outcome, "changed", changed.stderr);
  assert.deepEqual(changed.result.counts, {
    created: 0,
    updated: 1,
    unchanged: 0,
  });
  assert.equal(f.text("rev-parse", `${f.branch}^`), before);
  assert.deepEqual(f.git("show", `${f.branch}^:${snapshotPath}`), raw);
  const captured = f.manifest().articles[article.article_id];
  assert.equal(captured.capture.observed_at, "2026-10-07T12:00:00.000Z");
  assert.deepEqual(captured.canonical, canonical);
  assert.equal(Object.keys(f.manifest().articles).length, 2);
  assert.equal(
    f.git("show", `${f.branch}:posts/${article.article_id}.md`).toString(),
    "Canonical **body**\n",
  );
  f.feed(
    items
      .replace("Discovery", "New discovery")
      .replace("2026-09-29T20:30:00+08:00", "2026-09-30T12:30:00Z"),
  );
  const discoveryOnly = await f.cli(feed, [], {
    COPILOT_CAPTURE_NOW: "2026-10-08T12:00:00.000Z",
  });
  assert.equal(discoveryOnly.result.outcome, "changed");
  const after = f.manifest().articles[article.article_id];
  assert.equal(after.capture.discovery_title, "New discovery");
  assert.equal(
    after.capture.discovery_published_at,
    "2026-09-30T12:30:00.000Z",
  );
  assert.equal(after.capture.snapshot_sha256, captured.capture.snapshot_sha256);
  assert.equal(after.capture.observed_at, captured.capture.observed_at);
  assert.deepEqual(after.canonical, canonical);
  assert.equal(f.text("rev-parse", "HEAD"), head);
  assert.deepEqual(f.git("diff", "--cached"), index);
  assert.deepEqual(f.git("diff"), work);
  assert.deepEqual(f.git("status", "--porcelain"), status);
});

test("empty feeds bootstrap once and existing noncanonical JSON formatting remains unchanged", async (t) => {
  const f = new Fixture(t);
  const feed = f.feed("");
  const first = await f.cli(feed);
  assert.equal(first.result.outcome, "changed");
  assert.deepEqual(first.result.counts, {
    created: 0,
    updated: 0,
    unchanged: 0,
  });
  assert.deepEqual(f.manifest(), { schema_version: 2, articles: {} });
  assert.equal((await f.cli(feed)).result.outcome, "no-change");
  const source = f.source("article.html", "source bytes");
  f.feed(`<item><link>${source}</link></item>`);
  assert.equal((await f.cli(feed)).code, 0);
  const manifest = f.manifest();
  const article = Object.values(manifest.articles)[0] as any;
  article.capture = {
    discovery_title: article.capture.discovery_title,
    discovery_published_at: article.capture.discovery_published_at,
    observed_at: article.capture.observed_at,
    snapshot_sha256: article.capture.snapshot_sha256,
  };
  const persisted = JSON.stringify({
    articles: manifest.articles,
    schema_version: 2,
  });
  f.seed({ "metadata.json": persisted });
  const before = f.tip();
  assert.equal((await f.cli(feed)).result.outcome, "no-change");
  assert.equal(f.tip(), before);
  assert.equal(
    f.git("show", `${f.branch}:metadata.json`).toString(),
    persisted,
  );
});

test("an existing empty archive extends its history when initialized", async (t) => {
  const f = new Fixture(t);
  f.seed({});
  const before = f.tip();
  const result = await f.cli(f.feed(""));
  assert.equal(result.result.outcome, "changed", result.stderr);
  assert.equal(result.result.archive_input, before);
  assert.equal(f.text("rev-parse", `${f.branch}^`), before);
  assert.deepEqual(f.manifest(), { schema_version: 2, articles: {} });
});
