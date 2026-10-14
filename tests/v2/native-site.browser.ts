import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { load } from "cheerio";
import { NativeSiteFixture } from "./native-site-support.js";
import { serveArtifact, openArtifact, tree } from "./search-support.js";
import { savedNormalization } from "./normalization-support.js";
import { root } from "./support.js";

const base = "/copilot-changelog-mirror/";
const results = (page: Page) => page.locator(".pagefind-ui__result-link");
const input = (page: Page) =>
  page.getByRole("textbox", { name: "Search announcements" });
async function search(page: Page, query: string, title?: string) {
  await input(page).fill(query);
  if (title) await expect(results(page)).toHaveText(title);
  else {
    await expect(page.locator(".pagefind-ui__message")).toContainText(
      "No results",
    );
    await expect(results(page)).toHaveCount(0);
  }
}

// A single real artifact is shared by DOM, search, interaction and fallback assertions.
test("native offline artifact preserves presentation and maintained search behavior", async (t) => {
  const started = performance.now();
  const f = new NativeSiteFixture(t);
  const extracts = [
    {
      file: "weekly-skills",
      slug: "2026-09-25-github-copilot-weekly-releases-september-21",
    },
    {
      file: "feedback-video",
      slug: "2026-09-29-gpt-6-1-sol-in-github-copilot",
    },
    {
      file: "lists-media",
      slug: "2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app",
    },
  ].map(({ file, slug }) => {
    const normalized = savedNormalization(
      readFileSync(join(root, `tests/fixtures/minimal/${file}.html`), "utf8"),
      `https://github.blog/changelog/${slug}/`,
    );
    return {
      slug,
      title: normalized.canonical.title,
      body: normalized.body,
      time: normalized.canonical.published_at,
    };
  });
  const longTitle = "Interoperability ".repeat(24).trim();
  f.seed([
    ...extracts,
    {
      slug: "nebula",
      title: "Nebula <tools> & workflows",
      time: "2026-10-12T00:00:00.000Z",
      body: 'nebulasentinel for diagnostics. &lt;img src=x onerror="window.injected=1"&gt;\n\n<a id="section-target"></a>\n\n## Section target\n\nsectionsentinel for deep links.\n',
    },
    {
      slug: "long",
      title: longTitle,
      time: "2026-10-11T00:00:00.000Z",
      body: `galaxiesentinel. ${"Long matching excerpt ".repeat(40)}\n`,
    },
    {
      slug: "code",
      title: "Code & emoji",
      body: '# Body section\n\n<h1 id="html-section">HTML section</h1>\n\n<a id="emoji-target"></a>\n\n## 🚀 Try it out + share feedback\n\n[Try it](#emoji-target)\n\n```python\ndef first_frame(lines):\n    return next(iter(lines), None)\n```\n\nUse `value_1 * 2` inline.\n\n<iframe src="https://github.blog/embed/demo"></iframe>\n',
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      slug: `continuation-${i}`,
      title: `Continuation ${i}`,
      time: i < 2 ? "2026-10-10T00:00:00.000Z" : null,
      body: "constellationsentinel workflows.\n",
    })),
  ]);
  // A dangling raw directory proves no raw tree walk; raw-integrity checks belong elsewhere.
  const { symlinkSync, readlinkSync } = await import("node:fs");
  symlinkSync(
    join(f.dir, "unavailable-raw-evidence"),
    join(f.archive, "snapshots"),
  );
  const metadataBefore = readFileSync(join(f.archive, "metadata.json"));
  const bodiesBefore = tree(join(f.archive, "posts"));
  const networkLog = join(f.dir, "network.log");
  const guard = join(root, "tests/v2/block-network.mjs");
  // Positive control: attempted acquisition is recorded even if callers swallow the exception.
  await promisify(execFile)(
    process.execPath,
    [
      "--import",
      guard,
      "--input-type=module",
      "-e",
      'try { await fetch("https://github.blog/") } catch {}',
    ],
    { env: { ...process.env, COPILOT_NETWORK_LOG: networkLog } },
  );
  assert.match(readFileSync(networkLog, "utf8"), /attempted network/);
  writeFileSync(networkLog, "");
  const built = await f.cli([], { COPILOT_NETWORK_LOG: networkLog }, [guard]);
  assert.equal(built.code, 0, built.stderr);
  assert.equal(built.result.article_count, 14);
  assert.equal(readFileSync(networkLog, "utf8"), "");
  assert.deepEqual(
    readFileSync(join(f.archive, "metadata.json")),
    metadataBefore,
  );
  assert.deepEqual(tree(join(f.archive, "posts")), bodiesBefore);
  assert.equal(
    readlinkSync(join(f.archive, "snapshots")),
    join(f.dir, "unavailable-raw-evidence"),
  );
  assert.ok(
    !readdirSync(f.dir).some((name) =>
      name.startsWith(".copilot-native-incomplete-"),
    ),
  );
  const setup_ms = performance.now() - started;
  const output = built.result.output;
  const $ = load(readFileSync(join(output, "index.html"), "utf8"));
  assert.deepEqual(
    $(".article-list h2")
      .toArray()
      .slice(0, 4)
      .map((n) => $(n).text()),
    [
      "Nebula <tools> & workflows",
      longTitle,
      "Continuation 0",
      "Continuation 1",
    ],
  );
  assert.equal($(".article-list time").length, 7);
  for (const link of $(".article-list a").toArray())
    assert.ok($(link).attr("href")?.startsWith(`${base}posts/`));
  assert.ok(existsSync(join(output, "pagefind/pagefind.js")));
  assert.ok(!existsSync(join(output, "metadata.json")));

  await t.test(
    "independently expected authentic editorial structure, anchors and media",
    () => {
      const weekly = load(
        readFileSync(
          join(output, `posts/${extracts[0]!.slug}/index.html`),
          "utf8",
        ),
      );
      assert.equal(weekly("h1").length, 1);
      assert.deepEqual(
        weekly(".article-body li")
          .toArray()
          .map((n) => weekly(n).text()),
        [
          "Assisted approvals, now in public preview for Copilot agent sessions, automatically approve low-risk tool calls while prompting you for higher-risk actions.",
          "Edit an earlier message to redirect an agent session and Copilot rewinds both the conversation and file changes before sending the replacement request.",
          "Shared organization and enterprise skills, along with organization-managed custom instructions, now work in local and Copilot agent sessions.",
        ],
      );
      assert.equal(weekly(".article-body img").length, 1);
      assert.equal(
        weekly("a.source").attr("href"),
        `https://github.blog/changelog/${extracts[0]!.slug}/`,
      );
      const feedback = load(
        readFileSync(
          join(output, `posts/${extracts[1]!.slug}/index.html`),
          "utf8",
        ),
      );
      assert.equal(feedback(".article-body h3").text(), "Share your feedback");
      assert.equal(feedback("video").length, 1);
      for (const link of feedback(".article-body a[href^='#']").toArray())
        assert.equal(
          feedback(`[id='${feedback(link).attr("href")!.slice(1)}']`).length,
          1,
        );
      const lists = load(
        readFileSync(
          join(output, `posts/${extracts[2]!.slug}/index.html`),
          "utf8",
        ),
      );
      assert.deepEqual(
        lists(".article-body strong")
          .toArray()
          .map((n) => lists(n).text()),
        ["Single:", "Cascade:", "Critique:"],
      );
      assert.equal(lists("img").length, 0);
      for (const page of [weekly, feedback, lists])
        assert.ok(!page(".article-body").text().includes("Table of Contents"));
      const code = load(
        readFileSync(join(output, "posts/code/index.html"), "utf8"),
      );
      assert.equal(code("h1").length, 1);
      assert.equal(code("#html-section").prop("tagName"), "H2");
      assert.equal(
        code("pre code").text().trim(),
        "def first_frame(lines):\n    return next(iter(lines), None)",
      );
      assert.equal(code("p code").text(), "value_1 * 2");
      assert.equal(
        code("iframe").attr("src"),
        "https://github.blog/embed/demo",
      );
      assert.equal(code("#emoji-target").length, 1);
      assert.equal(code("time").length, 0);
    },
  );

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const { origin, url, missing } = await serveArtifact(t, output, base);
  const browserStarted = performance.now();
  await t.test(
    "title/body search, escaped results, scope, continuation, navigation and mobile",
    async () => {
      const { context, page } = await openArtifact(browser, origin);
      try {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(url);
        await input(page).focus();
        assert.equal(
          await input(page).evaluate((n) => getComputedStyle(n).outlineStyle),
          "solid",
        );
        await search(page, "nebulasentinel", "Nebula <tools> & workflows");
        await expect(page.locator("[data-search-feedback]")).toContainText(
          "1 result",
        );
        await expect(
          page.locator(".pagefind-ui__result-excerpt"),
        ).toContainText("diagnostics");
        assert.equal(
          await page.evaluate(() => (window as any).injected),
          undefined,
        );
        await results(page).first().focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(`${url}posts/nebula/`);
        await expect(page.locator("h1")).toHaveText(
          "Nebula <tools> & workflows",
        );
        await page.getByRole("link", { name: "← All announcements" }).click();
        await search(page, "Nebula", "Nebula <tools> & workflows");
        for (const word of [
          "discoverysentinel",
          "Mirrored",
          "original",
          "qznonexistent",
        ])
          await search(page, word);
        await input(page).fill("constellationsentinel");
        await expect(page.locator(".pagefind-ui__message")).toContainText(
          "8 results",
        );
        const more = page.getByRole("button", { name: "Load more results" });
        await expect(more).toBeVisible();
        await more.click();
        await expect(results(page)).toHaveCount(8);
        await expect(more).toBeHidden();
        await page.getByRole("button", { name: "Clear" }).click();
        await expect(input(page)).toHaveValue("");
        await expect(results(page)).toHaveCount(0);
        await page.setViewportSize({ width: 320, height: 700 });
        await search(page, "galaxiesentinel", longTitle);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: "/tmp/issue-34-native-mobile.png",
          fullPage: true,
        });
        await results(page).click();
        await expect(page).toHaveURL(`${url}posts/long/`);
        await page.getByRole("link", { name: "← All announcements" }).click();
        await input(page).fill("sectionsentinel");
        await expect(results(page).first()).toBeVisible();
        const hrefs = await results(page).evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("href")!),
        );
        assert.ok(
          hrefs.some((href) => href.includes("#")),
          "Search returns a usable section target",
        );
        for (const href of hrefs) {
          assert.ok(href.startsWith(`${base}posts/nebula/`));
          await page.goto(origin + href);
          if (new URL(page.url()).hash)
            await expect(page.locator(new URL(page.url()).hash)).toHaveCount(1);
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    },
  );
  await t.test(
    "delayed initialization keeps the current query and clearing suppresses stale results",
    async () => {
      const { context, page } = await openArtifact(browser, origin);
      try {
        let release!: () => void;
        let requested!: () => void;
        const waiting = new Promise<void>((resolve) => {
          requested = resolve;
        });
        const delayed = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route("**/pagefind/pagefind.js", async (route) => {
          requested();
          await delayed;
          await route.continue();
        });
        await page.goto(url);
        await input(page).fill("nebulasentinel");
        await waiting;
        await expect(page.locator(".pagefind-ui__message")).toContainText(
          "Searching",
        );
        await input(page).fill("galaxiesentinel");
        release();
        await expect(results(page)).toHaveText(longTitle);
        await input(page).fill("nebulasentinel");
        await input(page).fill("");
        await expect(results(page)).toHaveCount(0);
      } finally {
        await context.close();
      }
    },
  );
  for (const asset of [
    "pagefind-ui.js",
    "pagefind.js",
    "pagefind-entry.json*",
    "index/*",
    "index/*:404",
    "fragment/*",
  ])
    await t.test(
      `failed real search asset ${asset} leaves browsing available`,
      async () => {
        const { context, page } = await openArtifact(browser, origin);
        try {
          let failures = 0;
          await page.route(
            `**/pagefind/${asset.replace(":404", "")}`,
            (route) => {
              failures++;
              return asset.endsWith(":404")
                ? route.fulfill({ status: 404, body: "Unavailable" })
                : route.abort();
            },
          );
          await page.goto(url);
          if (asset !== "pagefind-ui.js")
            await input(page).fill("nebulasentinel");
          await expect(page.locator("[data-search-fallback]")).toContainText(
            "Search could not load",
          );
          assert.ok(failures > 0);
          await page.locator(".article-list a").first().click();
          await expect(page.locator("h1")).toBeVisible();
        } finally {
          await context.close();
        }
      },
    );
  await t.test(
    "JavaScript-disabled listing, navigation and explicit section fragments remain usable",
    async () => {
      const { context, page } = await openArtifact(browser, origin, {
        javaScriptEnabled: false,
      });
      try {
        await page.goto(url);
        await expect(page.locator("[data-search-fallback]")).toContainText(
          "Search needs JavaScript",
        );
        await page
          .getByRole("link", { name: "Code & emoji", exact: true })
          .click();
        await page.getByRole("link", { name: "Try it", exact: true }).click();
        await expect(page).toHaveURL(`${url}posts/code/#emoji-target`);
      } finally {
        await context.close();
      }
    },
  );
  assert.deepEqual(missing, []);
  const browser_ms = performance.now() - browserStarted;
  const tool_counts = { ...built.tool_counts };
  await t.test(
    "changed complete corpus refreshes terms and membership at root base",
    async (t) => {
      const changed = new NativeSiteFixture(t);
      changed.seed([
        {
          slug: "nebula",
          title: "Updated canonical title",
          body: "newsentinel fresh explanation.\n",
        },
        {
          slug: "added",
          title: "New announcement",
          body: "additionsentinel.\n",
        },
      ]);
      const refreshed = await changed.cli(["--base", "/"]);
      assert.equal(refreshed.code, 0, refreshed.stderr);
      tool_counts.astro += refreshed.tool_counts.astro;
      tool_counts.pagefind += refreshed.tool_counts.pagefind;
      const serving = await serveArtifact(t, refreshed.result.output, "/");
      const { context, page } = await openArtifact(browser, serving.origin);
      try {
        await page.goto(serving.url);
        await search(page, "newsentinel", "Updated canonical title");
        await search(page, "Updated", "Updated canonical title");
        await search(page, "additionsentinel", "New announcement");
        for (const word of [
          "nebulasentinel",
          "galaxiesentinel",
          "constellationsentinel",
        ])
          await search(page, word);
        assert.ok(
          !existsSync(join(refreshed.result.output, "posts/long/index.html")),
        );
        await search(page, "newsentinel", "Updated canonical title");
        await results(page).click();
        await expect(page).toHaveURL(`${serving.url}posts/nebula/`);
      } finally {
        await context.close();
      }
      assert.deepEqual(serving.missing, []);
    },
  );
  await t.test(
    "empty corpus executes actual indexing and leaves a browsable empty state",
    async (t) => {
      const empty = new NativeSiteFixture(t);
      empty.seed();
      const built = await empty.cli();
      assert.equal(built.code, 0, built.stderr);
      assert.ok(built.result.timings.pagefind_ms > 0);
      tool_counts.astro += built.tool_counts.astro;
      tool_counts.pagefind += built.tool_counts.pagefind;
      assert.match(built.stderr, /0 HTML files|0 pages/);
      const serving = await serveArtifact(t, built.result.output, base);
      const { context, page } = await openArtifact(browser, serving.origin);
      try {
        await page.goto(serving.url);
        await expect(page.locator(".empty")).toContainText("No announcements");
        await expect(page.locator("[data-native-search]")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Copilot Changelog Archive home" }),
        ).toBeVisible();
      } finally {
        await context.close();
      }
    },
  );
  t.diagnostic(
    JSON.stringify({
      setup_ms,
      ...built.result.timings,
      browser_ms,
      astro_invocations: tool_counts.astro,
      pagefind_invocations: tool_counts.pagefind,
      shared_primary_setups: 1,
    }),
  );
});
