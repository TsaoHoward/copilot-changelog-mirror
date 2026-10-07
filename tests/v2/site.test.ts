import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import { Fixture, seedArticle } from "./support.js";
import { exportArchive, siteCommand } from "./site-support.js";

test("real Astro build consumes canonical bodies, escapes metadata and agrees with identity-only command", async (t) => {
  const f = new Fixture(t);
  seedArticle(
    f,
    "<article><h1>Canonical &lt;title&gt;</h1><h2>Useful section!</h2><p>Complete <strong>article</strong> body.</p></article>",
  );
  assert.equal((await f.render()).code, 0);
  const archive = exportArchive(f);
  const output = join(f.dir, "output");
  const identity = await siteCommand(f, archive, "identity");
  assert.equal(identity.code, 0, identity.stderr);
  const built = await siteCommand(f, archive, "build", [
    "--output",
    output,
    "--base",
    "/copilot-changelog-mirror/",
  ]);
  assert.equal(built.code, 0, built.stderr);
  assert.equal(
    built.result.deployment_identity,
    identity.result.deployment_identity,
  );
  assert.equal(built.result.article_count, 1);
  const listing = load(readFileSync(join(output, "index.html"), "utf8"));
  assert.equal(
    listing("a[href='/copilot-changelog-mirror/posts/article/']").text(),
    "Canonical <title>",
  );
  const article = load(
    readFileSync(join(output, "posts/article/index.html"), "utf8"),
  );
  assert.equal(article("h1").length, 1);
  assert.equal(article("h1").text(), "Canonical <title>");
  assert.equal(article(".article-body strong").text(), "article");
  assert.equal(
    article("a.source").attr("href"),
    "https://github.blog/changelog/article/",
  );
  assert.equal(article("a[href='/copilot-changelog-mirror/']").length, 2);
  assert.ok(!article.root().text().includes("Archived"));
});

test("listing uses canonical instants, lexical ties and nulls last; a complete empty archive is buildable", async (t) => {
  const {
    emptyManifest,
    updateCapture,
    updateRender,
    serializeManifest,
    sha256,
  } = await import("../../src/v2/domain.js");
  const f = new Fixture(t);
  let manifest = emptyManifest();
  const files: Record<string, string> = {};
  for (const [slug, time] of [
    ["null-b", null],
    ["tie-b", "2026-10-01T00:00:00.000Z"],
    ["newest", "2026-10-02T00:00:00.000Z"],
    ["null-a", null],
    ["tie-a", "2026-10-01T00:00:00.000Z"],
  ] as const) {
    const source = `https://github.blog/changelog/${slug}/`;
    manifest = updateCapture(manifest, source, {
      snapshot_sha256: sha256("raw"),
      observed_at: "2026-10-06T00:00:00.000Z",
      discovery_title: "Wrong title",
      discovery_published_at: "2030-01-01T00:00:00.000Z",
    });
    const id = Object.values(manifest.articles).find(
      (a) => a.source_url === source,
    )!.article_id;
    manifest = updateRender(manifest, id, {
      title: slug,
      published_at: time,
      publication_path: `/posts/${slug}/`,
    });
    files[`snapshots/${id}.html`] = "raw";
    files[`posts/${id}.md`] = "Canonical body.\n";
  }
  files["metadata.json"] = JSON.stringify(manifest);
  f.seed(files);
  const archive = exportArchive(f);
  const output = join(f.dir, "listing");
  const built = await siteCommand(f, archive, "build", [
    "--output",
    output,
    "--base",
    "/",
  ]);
  assert.equal(built.code, 0, built.stderr);
  const $ = load(readFileSync(join(output, "index.html"), "utf8"));
  assert.deepEqual(
    $(".article-list h2")
      .toArray()
      .map((h) => $(h).text()),
    ["newest", "tie-a", "tie-b", "null-a", "null-b"],
  );
  assert.equal($("time").length, 3);
  assert.ok(
    !$.root().text().includes("2030") &&
      !$.root().text().includes("Wrong title"),
  );
  const undated = load(
    readFileSync(join(output, "posts/null-a/index.html"), "utf8"),
  );
  assert.equal(undated("time").length, 0);
  const empty = join(f.dir, "empty");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(empty);
  writeFileSync(
    join(empty, "metadata.json"),
    serializeManifest(emptyManifest()),
  );
  const emptyResult = await siteCommand(f, empty, "build", [
    "--output",
    join(f.dir, "empty-output"),
  ]);
  assert.equal(emptyResult.code, 0, emptyResult.stderr);
  assert.equal(emptyResult.result.article_count, 0);
  assert.match(
    readFileSync(join(f.dir, "empty-output/index.html"), "utf8"),
    /No announcements have been archived yet/,
  );
});

test("supplemental article preserves code, punctuation/emoji fragments, substantive TOC and external media", async (t) => {
  const { root } = await import("./support.js");
  const f = new Fixture(t);
  const html = readFileSync(
    join(root, "tests/fixtures/github_changelog_article.html"),
    "utf8",
  ).replace(
    "</article>",
    '<p>Shared organization and enterprise skills remain useful.</p><h2>Share your feedback</h2><p>Use <code>value_1 * 2</code> inline.</p><video src="/demo.mp4" poster="/poster.png"><source src="/demo.webm"></video><iframe src="/embed/demo"></iframe></article>',
  );
  seedArticle(
    f,
    html,
    "https://github.blog/changelog/copilot-debugging-fixture/",
  );
  assert.equal((await f.render()).code, 0);
  const built = await siteCommand(f, exportArchive(f), "build", [
    "--output",
    join(f.dir, "output"),
  ]);
  assert.equal(built.code, 0, built.stderr);
  const $ = load(
    readFileSync(
      join(f.dir, "output/posts/copilot-debugging-fixture/index.html"),
      "utf8",
    ),
  );
  assert.equal($("h1").length, 1);
  assert.equal(
    $("pre code").text().trim(),
    "def first_frame(lines):\n    return next(iter(lines), None)",
  );
  assert.equal($("p code").text(), "value_1 * 2");
  assert.ok(
    $(".article-body")
      .text()
      .includes("Shared organization and enterprise skills remain useful."),
  );
  assert.equal($("video").attr("src"), "https://github.blog/demo.mp4");
  assert.equal($("video").attr("poster"), "https://github.blog/poster.png");
  assert.equal($("source").attr("src"), "https://github.blog/demo.webm");
  assert.equal($("iframe").attr("src"), "https://github.blog/embed/demo");
  assert.equal(
    $("img").attr("src"),
    "https://github.blog/wp-content/uploads/debugging.png",
  );
  assert.equal($(".article-body a[href^='#']").length, 3);
  for (const link of $("a[href^='#']").toArray())
    assert.equal($(`[id='${$(link).attr("href")!.slice(1)}']`).length, 1);
});

test("evidence-only revisions preserve identities and selected publication, including dirty application work", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const { serializeManifest, sha256 } = await import("../../src/v2/domain.js");
  const f = new Fixture(t);
  const id = seedArticle(
    f,
    "<article><h1>Title</h1><p>Stable body.</p></article>",
  );
  assert.equal((await f.render()).code, 0);
  const pinned = exportArchive(f, "pinned");
  const before = await siteCommand(f, pinned, "identity");
  const manifest = f.manifest();
  const raw =
    "<aside>Changed chrome</aside><article><h1>Title</h1><p>Stable body.</p></article>";
  manifest.articles[id].capture = {
    snapshot_sha256: sha256(raw),
    observed_at: "2026-10-07T00:00:00.000Z",
    discovery_title: "Unused new feed title",
    discovery_published_at: "2026-09-01T00:00:00.000Z",
  };
  const priorTip = f.tip();
  f.seed({
    "metadata.json": serializeManifest(manifest),
    [`snapshots/${id}.html`]: raw,
  });
  assert.equal((await f.render()).result.publication_outcome, "no-change");
  assert.notEqual(f.tip(), priorTip);
  const changed = exportArchive(f, "changed");
  const after = await siteCommand(f, changed, "identity");
  assert.equal(
    before.result.publication_identity,
    after.result.publication_identity,
  );
  assert.equal(
    before.result.deployment_identity,
    after.result.deployment_identity,
  );
  // A later canonical tip must not replace a previously selected export.
  manifest.articles[id].canonical.title = "Later moving tip";
  f.seed({ "metadata.json": serializeManifest(manifest) });
  writeFileSync(join(f.repo, "app.txt"), "staged user work");
  f.git("add", "app.txt");
  writeFileSync(join(f.repo, "app.txt"), "unstaged user work");
  writeFileSync(join(f.repo, "untracked.txt"), "untracked user work");
  const status = f.git("status", "--porcelain=v1");
  const index = readFileSync(join(f.repo, ".git/index"));
  const archiveTree = f.git("archive", f.tip());
  const built = await siteCommand(f, pinned, "build", [
    "--output",
    join(f.dir, "output"),
  ]);
  assert.equal(built.code, 0, built.stderr);
  assert.equal(
    built.result.deployment_identity,
    before.result.deployment_identity,
  );
  assert.match(
    readFileSync(join(f.dir, "output/posts/article/index.html"), "utf8"),
    /<h1>Title<\/h1>/,
  );
  assert.deepEqual(f.git("status", "--porcelain=v1"), status);
  assert.deepEqual(readFileSync(join(f.repo, ".git/index")), index);
  assert.deepEqual(f.git("archive", f.tip()), archiveTree);
  assert.equal(
    readFileSync(join(f.repo, "app.txt"), "utf8"),
    "unstaged user work",
  );
  assert.equal(
    readFileSync(join(f.repo, "untracked.txt"), "utf8"),
    "untracked user work",
  );
});

test("canonical body headings cannot introduce a second editorial H1", async (t) => {
  const { writeFileSync } = await import("node:fs");
  const f = new Fixture(t);
  const id = seedArticle(
    f,
    "<article><h1>Editorial title</h1><p>Body.</p></article>",
  );
  assert.equal((await f.render()).code, 0);
  const archive = exportArchive(f);
  const body =
    "# Body section\n\n<h1>HTML section</h1>\n\nSubstantive content.\n";
  const path = join(archive, "posts", `${id}.md`);
  writeFileSync(path, body);
  const built = await siteCommand(f, archive, "build", [
    "--output",
    join(f.dir, "output"),
  ]);
  assert.equal(built.code, 0, built.stderr);
  const $ = load(
    readFileSync(join(f.dir, "output/posts/article/index.html"), "utf8"),
  );
  assert.equal($("h1").length, 1);
  assert.equal($("h1").text(), "Editorial title");
  assert.deepEqual(
    $(".article-body h2")
      .toArray()
      .map((n) => $(n).text()),
    ["Body section", "HTML section"],
  );
  assert.equal(readFileSync(path, "utf8"), body);
});
