import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, root, seedArticle } from "./support.js";

test("offline render initializes canonical state once and preserves evidence on reruns", async (t) => {
  const f = new Fixture(t);
  const url = f.source(
    "article.html",
    "<article><h1>Editorial title</h1><p>The complete body.</p></article>",
  );
  assert.equal(
    (
      await f.cli(
        f.feed(`<item><title>Feed title</title><link>${url}</link></item>`),
      )
    ).code,
    0,
  );
  const before = f.tip();
  const original = Object.values(f.manifest().articles)[0] as any;
  const snapshot = `snapshots/${original.article_id}.html`;
  const evidence = f.git("show", `${f.branch}:${snapshot}`);
  const result = await f.cli(undefined, [], {}, "render");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.outcome, "changed");
  assert.equal(result.result.publication_outcome, "initialized");
  assert.equal(result.result.publication_input, null);
  assert.match(result.result.publication_output, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.result.counts, {
    rendered: 1,
    updated: 1,
    unchanged: 0,
  });
  assert.equal(f.text("rev-parse", `${f.branch}^`), before);
  assert.deepEqual(f.git("show", `${f.branch}:${snapshot}`), evidence);
  const article = f.manifest().articles[original.article_id];
  assert.deepEqual(article.capture, original.capture);
  assert.equal(article.canonical.title, "Editorial title");
  assert.equal(article.canonical.published_at, null);
  assert.equal(article.canonical.publication_path, "/posts/article/");
  assert.equal(
    f.git("show", `${f.branch}:posts/${original.article_id}.md`).toString(),
    "The complete body.\n",
  );
  const tip = f.tip();
  const tree = f.text("rev-parse", `${f.branch}^{tree}`);
  const again = await f.cli(
    undefined,
    [],
    { COPILOT_CAPTURE_NOW: "invalid", RUN_ID: "other" },
    "render",
  );
  assert.equal(again.code, 0, again.stderr);
  assert.equal(again.result.outcome, "no-change");
  assert.equal(again.result.publication_outcome, "no-change");
  assert.equal(
    again.result.publication_input,
    result.result.publication_output,
  );
  assert.equal(
    again.result.publication_output,
    result.result.publication_output,
  );
  assert.equal(f.tip(), tip);
  assert.equal(f.text("rev-parse", `${f.branch}^{tree}`), tree);
});

test("network guard records an intentional attempt even when the caller catches it", (t) => {
  const f = new Fixture(t);
  for (const expression of [
    "fetch('https://github.blog')",
    "require('node:http').get('http://example.test')",
    "require('node:https').get('https://example.test')",
    "require('node:net').connect(443, 'example.test')",
  ]) {
    const log = join(f.dir, "control.log");
    writeFileSync(log, "");
    execFileSync(
      process.execPath,
      [
        "--import",
        join(root, "tests/v2/block-network.mjs"),
        "-e",
        `try { ${expression}; } catch {}`,
      ],
      { env: { ...process.env, COPILOT_NETWORK_LOG: log }, stdio: "pipe" },
    );
    assert.match(readFileSync(log, "utf8"), /attempted/);
  }
});

test("raw chrome and unused capture changes preserve publication; selected body/title/time change it", async (t) => {
  const f = new Fixture(t);
  const source = "https://github.blog/changelog/article/";
  const html = (
    title = "HTML title",
    body = "Editorial body.",
    time = "2026-10-01T12:00:00Z",
    chrome = "old chrome",
  ) =>
    `<nav>${chrome}</nav><script type="application/ld+json">${JSON.stringify({ "@type": "Article", url: source, datePublished: time })}</script><article><h1>${title}</h1><p>${body}</p></article>`;
  const id = seedArticle(f, html());
  const first = await f.render();
  assert.equal(first.code, 0, first.stderr);
  let identity = first.result.publication_output;
  const bodyPath = `posts/${id}.md`;
  let originalBody = f.git("show", `${f.branch}:${bodyPath}`);
  for (const [name, bytes, observation, expected] of [
    [
      "raw chrome",
      html(undefined, undefined, undefined, "different navigation"),
      {},
      "no-change",
    ],
    [
      "unused discovery",
      html(),
      {
        discovery_title: "Different feed",
        discovery_published_at: "2020-01-01T00:00:00.000Z",
      },
      "no-change",
    ],
    [
      "editorial body",
      html(undefined, "Changed editorial body."),
      {},
      "changed",
    ],
    [
      "selected title",
      html("Changed title", "Changed editorial body."),
      {},
      "changed",
    ],
    [
      "selected time",
      html("Changed title", "Changed editorial body.", "2026-10-02T12:00:00Z"),
      {},
      "changed",
    ],
  ] as const) {
    const old = f.manifest().articles[id];
    const candidate = updateCapture(f.manifest(), source, {
      ...old.capture,
      ...observation,
      snapshot_sha256: sha256(bytes),
      observed_at: "2026-10-03T00:00:00.000Z",
    });
    // Deliberately change manifest formatting and key insertion order during capture.
    f.seed({
      "metadata.json": JSON.stringify(candidate),
      [`snapshots/${id}.html`]: bytes,
    });
    const before = f.tip();
    const storedManifest = f.git("show", `${f.branch}:metadata.json`);
    const result = await f.render([], {
      RUN_ID: name,
      ATTEMPT_ID: "different",
      COPILOT_CAPTURE_NOW: "invalid",
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.result.publication_outcome, expected, name);
    assert.equal(result.result.publication_input, identity, name);
    assert.deepEqual(
      f.manifest().articles[id].capture,
      candidate.articles[id]!.capture,
    );
    assert.equal(result.result.archive_input, before);
    if (expected === "no-change") {
      assert.equal(result.result.publication_output, identity);
      assert.equal(f.tip(), before);
      assert.deepEqual(
        f.git("show", `${f.branch}:metadata.json`),
        storedManifest,
      );
      assert.deepEqual(f.git("show", `${f.branch}:${bodyPath}`), originalBody);
      assert.deepEqual(result.result.counts, {
        rendered: 1,
        updated: 0,
        unchanged: 1,
      });
    } else {
      assert.notEqual(result.result.publication_output, identity);
      assert.equal(f.text("rev-parse", `${f.branch}^`), before);
      assert.deepEqual(result.result.counts, {
        rendered: 1,
        updated: 1,
        unchanged: 0,
      });
    }
    identity = result.result.publication_output;
    originalBody = f.git("show", `${f.branch}:${bodyPath}`);
  }
});

test("selected discovery fallbacks change publication and title/time never rename the public route", async (t) => {
  const f = new Fixture(t);
  const source = "https://github.blog/changelog/stable-source/";
  const id = seedArticle(
    f,
    "<article><p>Body without metadata.</p></article>",
    source,
    "First fallback",
    null,
  );
  const first = await f.render();
  let identity = first.result.publication_output;
  for (const patch of [
    { discovery_title: "Changed fallback" },
    { discovery_published_at: "2026-10-02T12:00:00.000Z" },
  ]) {
    const old = f.manifest().articles[id];
    const manifest = updateCapture(f.manifest(), source, {
      ...old.capture,
      ...patch,
    });
    f.seed({ "metadata.json": serializeManifest(manifest) });
    const result = await f.render();
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.result.publication_outcome, "changed");
    assert.notEqual(result.result.publication_output, identity);
    assert.equal(
      f.manifest().articles[id].canonical.publication_path,
      "/posts/stable-source/",
    );
    identity = result.result.publication_output;
  }
});

test("missing derived bodies repair offline and unrelated articles remain byte-for-byte intact", async (t) => {
  const f = new Fixture(t);
  const id = seedArticle(
    f,
    "<article><h1>Current</h1><p>Current body.</p></article>",
  );
  const older =
    "<article><h1>Older</h1><p>Outside the feed window.</p></article>";
  const manifest = updateCapture(
    f.manifest(),
    "https://example.test/historical/",
    {
      snapshot_sha256: sha256(older),
      observed_at: "2020-01-01T00:00:00.000Z",
      discovery_title: "Older",
      discovery_published_at: null,
    },
  );
  const oldId = Object.keys(manifest.articles).find((key) => key !== id)!;
  f.seed({
    "metadata.json": serializeManifest(manifest),
    [`snapshots/${oldId}.html`]: older,
  });
  assert.equal((await f.render()).code, 0);
  const bodies = [id, oldId].map((key) =>
    f.git("show", `${f.branch}:posts/${key}.md`),
  );
  const evidence = [id, oldId].map((key) =>
    f.git("show", `${f.branch}:snapshots/${key}.html`),
  );
  const beforeManifest = f.manifest();
  f.seed({}, {}, [`posts/${id}.md`]);
  const before = f.tip();
  const result = await f.render();
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.publication_input, null);
  assert.equal(result.result.publication_outcome, "initialized");
  assert.deepEqual(result.result.counts, {
    rendered: 2,
    updated: 1,
    unchanged: 1,
  });
  assert.equal(f.text("rev-parse", `${f.branch}^`), before);
  assert.deepEqual(f.manifest(), beforeManifest);
  [id, oldId].forEach((key, index) => {
    assert.deepEqual(
      f.git("show", `${f.branch}:posts/${key}.md`),
      bodies[index],
    );
    assert.deepEqual(
      f.git("show", `${f.branch}:snapshots/${key}.html`),
      evidence[index],
    );
  });
});

test("absent capture input fails; a persisted empty v2 archive renders an unchanged empty publication set", async (t) => {
  const f = new Fixture(t);
  const absent = await f.render();
  assert.equal(absent.code, 1);
  assert.match(absent.stderr, /capture first/);
  assert.throws(() => f.tip());
  f.seed({ "metadata.json": serializeManifest(emptyManifest()) });
  const tip = f.tip();
  const result = await f.render();
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.result.outcome, "no-change");
  assert.equal(result.result.publication_outcome, "no-change");
  assert.equal(
    result.result.publication_input,
    result.result.publication_output,
  );
  assert.deepEqual(result.result.counts, {
    rendered: 0,
    updated: 0,
    unchanged: 0,
  });
  assert.equal(f.tip(), tip);
  for (const flag of ["--feed-url", "--timeout-ms"]) {
    const failure = await f.render([
      flag,
      flag === "--feed-url" ? "https://github.blog" : "1",
    ]);
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /capture options/);
    assert.equal(f.tip(), tip);
  }
});
