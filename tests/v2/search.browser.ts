import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { serializeManifest, sha256 } from "../../src/v2/domain.js";
import { Fixture } from "./support.js";
import {
  seedCorpus,
  buildCorpus,
  serveArtifact,
  openArtifact,
} from "./search-support.js";

async function search(page: Page, query: string, count: number) {
  await page.getByLabel("Search announcements").fill(query);
  await expect(page.getByRole("status")).toHaveText(
    count
      ? new RegExp(`^${count} announcements? found`)
      : /No announcements found/,
  );
}

test("shipped search finds canonical bodies/titles and navigates at root and repository base paths", async (t) => {
  const f = new Fixture(t);
  const longTitle = "Interoperability ".repeat(24).trim();
  await seedCorpus(f, [
    {
      slug: "nebula",
      title: "Nebula &amp; &lt;tools&gt;",
      body: "Use nebulasentinel for detailed diagnostics and constellation workflows.",
    },
    {
      slug: "long",
      title: longTitle,
      body: `Use galaxiesentinel for constellation workflows. ${"Long matching excerpt ".repeat(40)}`,
    },
    ...Array.from({ length: 11 }, (_, i) => ({
      slug: `update-${i}`,
      title: `Update ${i}`,
      body: "A constellation workflow supports collaboration.",
    })),
  ]);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const base of ["/", "/copilot-changelog-mirror/"])
    await t.test(base, async (t) => {
      const { output } = await buildCorpus(
        f,
        base === "/" ? "root" : "project",
        base,
      );
      const { origin, url, missing } = await serveArtifact(t, output, base);
      const { context, page } = await openArtifact(browser, origin);
      t.after(() => context.close());
      const errors: string[] = [];
      const requests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().includes("/pagefind/")) requests.push(request.url());
      });
      await page.goto(url);
      await expect(page.getByRole("status")).toHaveText(/Enter words/);
      assert.equal(
        requests.length,
        0,
        "Search engine initializes only on a query",
      );
      const input = page.getByLabel("Search announcements");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(input).toBeFocused();
      assert.equal(
        await input.evaluate((node) => getComputedStyle(node).outlineStyle),
        "solid",
      );
      await page.keyboard.type("nebulasentinel");
      await expect(page.getByRole("status")).toHaveText(
        /^1 announcement found/,
      );
      const links = page.locator(".search-results a");
      await expect(links).toHaveText("Nebula & <tools>");
      await expect(page.locator(".search-results")).toContainText(
        "detailed diagnostics",
      );
      await expect(page.locator(".search-results mark")).toContainText(
        "nebulasentinel",
      );
      await page.keyboard.press("Tab");
      await expect(links).toBeFocused();
      assert.equal(
        await links.evaluate((node) => getComputedStyle(node).outlineStyle),
        "solid",
      );
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(`${url}posts/nebula/`);
      await expect(page.locator("h1")).toHaveText("Nebula & <tools>");
      await expect(page.locator(".article-body")).toContainText(
        "nebulasentinel",
      );
      await page.getByRole("link", { name: "← All announcements" }).click();
      await search(page, "Nebula", 1);
      await expect(links).toHaveText("Nebula & <tools>");
      for (const query of [
        "chromesentinel",
        "discoverysentinel",
        "Mirrored",
        "original",
        "qznonexistent",
      ])
        await search(page, query, 0);
      for (const query of [" ", ""]) {
        await input.fill(query);
        await expect(page.getByRole("status")).toHaveText(/Enter words/);
        await expect(links).toHaveCount(0);
      }
      await search(page, "constellation", 13);
      await expect(links).toHaveCount(10);
      await page.getByRole("button", { name: "Show more results" }).click();
      await expect(links).toHaveCount(13);
      await expect(
        page.getByRole("button", { name: "Show more results" }),
      ).toBeHidden();
      await page.setViewportSize({ width: 320, height: 700 });
      await search(page, "galaxiesentinel", 1);
      await expect(links).toHaveText(longTitle);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Narrow page has no horizontal overflow",
      );
      assert.ok((await input.boundingBox())!.width <= 320);
      await page.screenshot({
        path: `/tmp/issue-21-search-${base === "/" ? "root" : "project"}-mobile.png`,
        fullPage: true,
      });
      await links.click();
      await expect(page).toHaveURL(`${url}posts/long/`);
      assert.ok(requests.length > 0);
      assert.ok(
        requests.every((request) =>
          new URL(request).pathname.startsWith(`${base}pagefind/`),
        ),
      );
      assert.deepEqual(missing, []);
      assert.deepEqual(errors, []);
    });
});

test("loading, failures, rapid typing and clearing preserve current results and ordinary browsing", async (t) => {
  const f = new Fixture(t);
  await seedCorpus(f, [
    {
      slug: "first",
      title: "First announcement",
      body: "nebulasentinel diagnostic details.",
    },
    {
      slug: "second",
      title: "Second announcement",
      body: "galaxiesentinel collaboration details.",
    },
  ]);
  const { output } = await buildCorpus(
    f,
    "states",
    "/copilot-changelog-mirror/",
  );
  const { origin, url, missing } = await serveArtifact(
    t,
    output,
    "/copilot-changelog-mirror/",
  );
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const clear of [false, true])
    await t.test(
      clear ? "clearing a delayed result" : "new query while loading",
      async () => {
        const { context, page } = await openArtifact(browser, origin);
        try {
          let release!: () => void;
          let started!: () => void;
          const waiting = new Promise<void>((resolve) => {
            started = resolve;
          });
          const delayed = new Promise<void>((resolve) => {
            release = resolve;
          });
          const pattern = clear
            ? "**/pagefind/fragment/*"
            : "**/pagefind/pagefind.js";
          await page.route(pattern, async (route) => {
            started();
            await delayed;
            await route.continue();
          });
          await page.goto(url);
          const status = page.getByRole("status");
          await expect(status).toHaveAttribute("aria-live", "polite");
          const input = page.getByLabel("Search announcements");
          await input.fill("nebulasentinel");
          await waiting;
          await expect(status).toHaveText(/Searching/);
          await input.fill(clear ? "" : "galaxiesentinel");
          const finished = page.waitForResponse((response) =>
            clear
              ? response.url().includes("/pagefind/fragment/")
              : response.url().endsWith("/pagefind/pagefind.js"),
          );
          release();
          await (await finished).finished();
          await page.unroute(pattern);
          if (clear) {
            await expect(status).toHaveText(/Enter words/);
            await expect(page.locator(".search-results a")).toHaveCount(0);
            await search(page, "galaxiesentinel", 1);
          }
          await expect(status).toHaveText(/^1 announcement found/);
          await expect(page.locator(".search-results a")).toHaveText(
            "Second announcement",
          );
        } finally {
          await context.close();
        }
      },
    );
  for (const asset of [
    "pagefind.js",
    "pagefind-entry.json*",
    "fragment/*",
    "index/*",
    "index/*:404",
  ])
    await t.test(`failed ${asset}`, async () => {
      const { context, page } = await openArtifact(browser, origin);
      try {
        const notFound = asset.endsWith(":404");
        let failures = 0;
        await page.route(
          `**/pagefind/${asset.replace(":404", "")}`,
          (route) => {
            failures++;
            return notFound
              ? route.fulfill({ status: 404, body: "Asset unavailable" })
              : route.abort();
          },
        );
        await page.goto(url);
        await page.getByLabel("Search announcements").fill("nebulasentinel");
        await expect(page.getByRole("status")).toHaveText(
          /Search could not load.*browse/,
        );
        assert.ok(
          failures > 0,
          "The controlled failure affected an actual search asset request",
        );
        await page.getByLabel("Search announcements").fill("");
        await expect(page.getByRole("status")).toHaveText(/Enter words/);
        await expect(page.locator(".article-list a")).toHaveCount(2);
        await page.locator(".article-list a").first().click();
        await expect(page.locator("h1")).toBeVisible();
      } finally {
        await context.close();
      }
    });
  await t.test("JavaScript unavailable", async () => {
    const { context, page } = await openArtifact(browser, origin, {
      javaScriptEnabled: false,
    });
    try {
      await page.goto(url);
      await expect(page.getByRole("status")).toHaveText(
        /Search needs JavaScript.*browse/,
      );
      await expect(page.getByLabel("Search announcements")).toBeDisabled();
      await page.locator(".article-list a").first().click();
      await expect(page.locator("h1")).toBeVisible();
    } finally {
      await context.close();
    }
  });
  assert.deepEqual(missing, []);
});

test("fresh indexes reflect edits/additions/removals and evidence-only rebuilds preserve identities/results and application work", async (t) => {
  const f = new Fixture(t);
  await seedCorpus(f, [
    {
      slug: "edited",
      title: "Original title",
      body: "oldsentinel with stable explanation.",
    },
    {
      slug: "removed",
      title: "Removed title",
      body: "removalsentinel for earlier readers.",
    },
  ]);
  writeFileSync(join(f.repo, "app.txt"), "staged work");
  f.git("add", "app.txt");
  writeFileSync(join(f.repo, "app.txt"), "unstaged work");
  writeFileSync(join(f.repo, "untracked.txt"), "untracked work");
  const head = f.text("rev-parse", "HEAD");
  const index = readFileSync(join(f.repo, ".git/index"));
  const status = f.git("status", "--porcelain=v1");
  const original = await buildCorpus(f, "original", "/");
  const browser = await chromium.launch();
  t.after(() => browser.close());
  async function verify(
    output: string,
    name: string,
    checks: [string, number, string?][],
  ) {
    await t.test(name, async (t) => {
      const { origin, url, missing } = await serveArtifact(t, output, "/");
      const { context, page } = await openArtifact(browser, origin);
      try {
        await page.goto(url);
        for (const [query, count, title] of checks) {
          await search(page, query, count);
          if (title)
            await expect(page.locator(".search-results a")).toHaveText(title);
        }
        assert.deepEqual(missing, []);
      } finally {
        await context.close();
      }
    });
  }
  await verify(original.output, "original corpus", [
    ["oldsentinel", 1, "Original title"],
    ["removalsentinel", 1, "Removed title"],
  ]);
  const manifest = f.manifest();
  const changedRaw: Record<string, string> = {};
  for (const article of Object.values(manifest.articles) as any[]) {
    const raw = f
      .git("show", `${f.branch}:snapshots/${article.article_id}.html`)
      .toString()
      .replace("chromesentinel", "newchromesentinel");
    article.capture.snapshot_sha256 = sha256(raw);
    article.capture.observed_at = "2026-10-07T00:00:00.000Z";
    article.capture.discovery_title = "newdiscoverysentinel";
    changedRaw[`snapshots/${article.article_id}.html`] = raw;
  }
  f.seed({ ...changedRaw, "metadata.json": serializeManifest(manifest) });
  assert.equal((await f.render()).result.publication_outcome, "no-change");
  const evidence = await buildCorpus(f, "evidence", "/");
  assert.equal(
    evidence.result.publication_identity,
    original.result.publication_identity,
  );
  assert.equal(
    evidence.result.deployment_identity,
    original.result.deployment_identity,
  );
  await verify(evidence.output, "evidence-only corpus", [
    ["oldsentinel", 1, "Original title"],
    ["newchromesentinel", 0],
    ["newdiscoverysentinel", 0],
  ]);
  const edited = Object.values(manifest.articles).find((a: any) =>
    a.source_url.endsWith("/edited/"),
  ) as any;
  edited.canonical.title = "Updated canonical title";
  f.seed({
    "metadata.json": serializeManifest(manifest),
    [`posts/${edited.article_id}.md`]:
      "newsentinel with updated explanation.\n",
  });
  const updated = await buildCorpus(f, "updated", "/");
  assert.notEqual(
    updated.result.publication_identity,
    original.result.publication_identity,
  );
  assert.notEqual(
    updated.result.deployment_identity,
    original.result.deployment_identity,
  );
  await verify(updated.output, "edited corpus", [
    ["oldsentinel", 0],
    ["newsentinel", 1, "Updated canonical title"],
  ]);
  const oldPaths = Object.values(manifest.articles).flatMap((a: any) => [
    `posts/${a.article_id}.md`,
    `snapshots/${a.article_id}.html`,
  ]);
  f.seed(
    { "metadata.json": serializeManifest({ ...manifest, articles: {} }) },
    {},
    oldPaths,
  );
  await seedCorpus(f, [
    {
      slug: "edited",
      title: "Updated canonical title",
      body: "newsentinel with updated explanation.",
    },
    {
      slug: "added",
      title: "New announcement",
      body: "additionsentinel with a fresh explanation.",
    },
  ]);
  const membership = await buildCorpus(f, "membership", "/");
  await verify(membership.output, "added and removed corpus", [
    ["newsentinel", 1, "Updated canonical title"],
    ["additionsentinel", 1, "New announcement"],
    ["removalsentinel", 0],
  ]);
  assert.equal(f.text("rev-parse", "HEAD"), head);
  assert.deepEqual(readFileSync(join(f.repo, ".git/index")), index);
  assert.deepEqual(f.git("status", "--porcelain=v1"), status);
  assert.equal(readFileSync(join(f.repo, "app.txt"), "utf8"), "unstaged work");
  assert.equal(
    readFileSync(join(f.repo, "untracked.txt"), "utf8"),
    "untracked work",
  );
});

test("empty canonical archive shows an explicit empty state without a broken search control", async (t) => {
  const f = new Fixture(t);
  await seedCorpus(f, []);
  const { output } = await buildCorpus(
    f,
    "empty",
    "/copilot-changelog-mirror/",
  );
  const { origin, url, missing } = await serveArtifact(
    t,
    output,
    "/copilot-changelog-mirror/",
  );
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const { context, page } = await openArtifact(browser, origin);
  t.after(() => context.close());
  await page.goto(url);
  await expect(page.locator(".empty")).toHaveText(
    /No announcements have been archived yet/,
  );
  await expect(page.getByLabel("Search announcements")).toHaveCount(0);
  assert.deepEqual(missing, []);
});
