// Opt-in reader checks against a selected saved archive and an already served site.
// Does not acquire source, mutate the archive or publish anything.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { readManifest } from "../../src/v2/domain.js";

const archive = process.env.ARCHIVE_DIR;
const target = process.env.SITE_URL;
if (!archive || !target)
  throw new Error("ARCHIVE_DIR and SITE_URL are required");
const url = new URL(target);
assert.equal(url.pathname, "/copilot-changelog-mirror/");
const manifest = readManifest(readFileSync(join(archive, "metadata.json")));
const articles = Object.values(manifest.articles).toSorted((a, b) => {
  assert.ok(a.canonical && b.canonical, "Select complete saved derived inputs");
  const left = a.canonical.published_at ?? "";
  const right = b.canonical.published_at ?? "";
  return left === right
    ? a.article_id.localeCompare(b.article_id)
    : left > right
      ? -1
      : 1;
});
const path = (route: string) => url.pathname.slice(0, -1) + route;
const weeklyRoute =
  "/posts/2026-10-09-github-copilot-weekly-releases-october-5/";
// Source-reviewed literals from this persisted authentic weekly announcement.
// These expectations are not derived from the renderer being verified.
const weeklyTitle = "GitHub Copilot weekly releases — October 5";
const weeklyPhrase =
  "use an enterprise-provided Copilot license while accessing repositories through another account";
const weeklyImage =
  "https://github.com/user-attachments/assets/3ab87ebb-cca2-4008-b022-c1ffe4600471";

test("selected production publication retains listing, routes, attribution, anchors, media and title/body search", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  // Inspect references without depending on third-party media availability.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === url.origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const badLocal: string[] = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === url.origin &&
      response.status() >= 400
    )
      badLocal.push(`${response.status()} ${response.url()}`);
  });
  assert.equal((await page.goto(url.href))?.status(), 200);
  for (const asset of await page
    .locator("script[src], link[href]")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) => node.getAttribute("src") ?? node.getAttribute("href")!,
      ),
    )) {
    const resolved = new URL(asset, url);
    if (resolved.origin === url.origin)
      assert.ok(
        resolved.pathname.startsWith(url.pathname),
        `Local resource escapes repository base: ${asset}`,
      );
  }
  await expect(page.locator(".article-list h2 a")).toHaveText(
    articles.map((a) => a.canonical!.title),
  );
  assert.deepEqual(
    await page
      .locator(".article-list h2 a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href"))),
    articles.map((a) => path(a.canonical!.publication_path)),
  );
  assert.deepEqual(
    await page
      .locator(".article-list time")
      .evaluateAll((times) =>
        times.map((time) => time.getAttribute("datetime")),
      ),
    articles.flatMap((a) =>
      a.canonical!.published_at ? [a.canonical!.published_at] : [],
    ),
  );
  for (const article of articles) {
    const canonical = article.canonical!;
    assert.equal(
      (
        await page.goto(url.origin + path(canonical.publication_path))
      )?.status(),
      200,
    );
    await expect(page.locator("article h1")).toHaveText(canonical.title);
    await expect(page.locator("article a.source")).toHaveAttribute(
      "href",
      article.source_url,
    );
    if (canonical.published_at)
      await expect(page.locator("article time")).toHaveAttribute(
        "datetime",
        canonical.published_at,
      );
  }
  await page.goto(url.origin + path(weeklyRoute));
  await expect(page.locator(".article-body")).toContainText(weeklyPhrase);
  await expect(page.locator(`article img[src="${weeklyImage}"]`)).toHaveCount(
    1,
  );
  await expect(page.locator("article video")).toHaveAttribute(
    "src",
    "https://github.com/user-attachments/assets/62cad6fc-ca94-49f0-be15-febcbcdc6cd9",
  );
  await page.locator('article a[href="#archive-heading-2"]').click();
  assert.equal(new URL(page.url()).hash, "#archive-heading-2");
  await expect(page.locator("#archive-heading-2")).toBeInViewport();
  for (const query of ["weekly releases", "enterprise-provided"]) {
    await page.goto(url.href);
    const input = page
      .getByRole("textbox", { name: "Search announcements" })
      .or(page.getByRole("searchbox", { name: "Search announcements" }));
    await expect(input).toBeEnabled();
    await input.fill(query);
    const result = page
      .locator(
        `.search-results a[href="${path(weeklyRoute)}"], .pagefind-ui__result-link[href="${path(weeklyRoute)}"]`,
      )
      .first();
    await expect(result).toHaveText(weeklyTitle, { timeout: 15000 });
    await result.click();
    assert.equal(new URL(page.url()).pathname, path(weeklyRoute));
    await expect(page.locator("article h1")).toHaveText(weeklyTitle);
  }
  assert.deepEqual(
    badLocal,
    [],
    "All requested local assets/search resources must serve successfully",
  );
  console.log(
    JSON.stringify({
      observed_at: new Date().toISOString(),
      url: url.href,
      articles: articles.length,
      title_query: "weekly releases",
      body_query: "enterprise-provided",
      external_media: "references only; requests blocked",
    }),
  );
});
