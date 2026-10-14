import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { platform, release, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { load } from "cheerio";
import {
  emptyManifest,
  updateCapture,
  serializeManifest,
  sha256,
} from "../../src/v2/domain.js";
import { Fixture, root } from "./support.js";
import { exportArchive } from "./site-support.js";
import { serveArtifact, openArtifact, tree } from "./search-support.js";

// Literal publication instants read from the original saved TechArticle JSON-LD,
// independently of Render; frozen body/media expectations remain in production/*.json.
const times: Record<string, string> = {
  "2026-09-25-agentic-autofix-now-uses-copilot-memory-2653f5794fb9":
    "2026-09-25T17:25:50.000Z",
  "2026-09-25-github-copilot-weekly-releases-september-21-48eaa8bbafaa":
    "2026-09-25T16:42:48.000Z",
  "2026-09-25-usage-metrics-api-adds-pull-request-review-stages-0a10d0252c63":
    "2026-09-25T21:09:40.000Z",
  "2026-09-29-gpt-6-1-sol-in-github-copilot-27fa41ed5cc2":
    "2026-09-29T17:02:27.000Z",
  "2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app-cad13c49eff0":
    "2026-09-30T14:31:19.000Z",
  "2026-10-01-dynamic-workflows-in-copilot-cli-and-the-copilot-app-20f94898ac73":
    "2026-10-01T16:30:10.000Z",
};
const text = (value: string) => value.replace(/\s+/g, " ").trim();
const sourceText = (node: any): string =>
  node.type === "text"
    ? node.data
    : (node.children ?? []).map(sourceText).join(" ");
function semanticPage(path: string, expected: any, instant: string) {
  const $ = load(readFileSync(path, "utf8"));
  const body = $(".article-body");
  assert.equal($("h1").length, 1);
  assert.equal($("h1").text(), expected.title);
  assert.equal($("time").attr("datetime"), instant);
  assert.equal($("time").text().trim(), instant.slice(0, 10));
  assert.equal($("a.source").attr("href"), expected.source_url);
  const content = text(sourceText(body[0]));
  let offset = 0;
  for (const block of expected.blocks) {
    const literal = text(block.text);
    const position = content.indexOf(literal, offset);
    assert.ok(position >= offset, `Missing/reordered source block: ${literal}`);
    offset = position + literal.length;
  }
  const headings = body
    .find("h2,h3,h4,h5,h6")
    .toArray()
    .map((n) => text($(n).text()));
  assert.deepEqual(headings, expected.headings);
  const images = body
    .find("img")
    .toArray()
    .map((n) => ({ src: $(n).attr("src"), alt: $(n).attr("alt") ?? "" }));
  assert.deepEqual(images, expected.images);
  const videos = body
    .find("video")
    .toArray()
    .map((n) => $(n).attr("src"));
  assert.deepEqual(videos, expected.videos);
  const strong = body
    .find("strong")
    .toArray()
    .map((n) => text($(n).text()));
  assert.deepEqual(strong, expected.strong);
  const lists = Object.fromEntries(
    Object.keys(expected.lists).map((tag) => [tag, body.find(tag).length]),
  );
  assert.deepEqual(lists, expected.lists);
  const links = body
    .find("a")
    .toArray()
    .map((n) => $(n).attr("href"));
  for (const link of expected.links)
    assert.ok(links.includes(new URL(link, expected.source_url).href), link);
  const fragments = body
    .find("a[href^='#']")
    .toArray()
    .map((n) => $(n).attr("href")!);
  for (const fragment of fragments)
    assert.equal($(`[id='${fragment.slice(1)}']`).length, 1, fragment);
  for (const chrome of [
    "Table of Contents",
    "Copied",
    "Back to changelog",
    "Menu. Currently selected",
    "minute read",
  ])
    assert.ok(!body.text().includes(chrome));
  return {
    title: $("h1").text(),
    instant,
    source: $("a.source").attr("href"),
    content,
    headings,
    images,
    videos,
    strong,
    lists,
    links,
    fragments,
    heading_ids: body
      .find("h2,h3,h4,h5,h6")
      .toArray()
      .map((n) => $(n).attr("id")),
  };
}

// Migration-only: excluded from npm test and routine browser coverage.
test("original-corpus migration comparison and comparable build measurements", async (t) => {
  const evidence = process.env.COPILOT_SITE_COMPARISON_DIR;
  assert.ok(
    evidence,
    "Set COPILOT_SITE_COMPARISON_DIR to a fresh evidence directory",
  );
  mkdirSync(evidence);
  const baselineRef = "9c5c95ad050a992b29e0f3aaaa476e8059b92698";
  const baselineSource = join(evidence, "baseline-source");
  mkdirSync(baselineSource);
  execFileSync("tar", ["-xf", "-", "-C", baselineSource], {
    input: execFileSync("git", ["archive", baselineRef], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    }),
  });
  symlinkSync(join(root, "node_modules"), join(baselineSource, "node_modules"));
  // Timing-only instrumentation in the disposable baseline worker. No parser,
  // template, Pagefind option or fixture bytes change.
  const worker = join(baselineSource, "src/v2/presentation/astro.ts");
  writeFileSync(
    worker,
    readFileSync(worker, "utf8")
      .replace(
        'cacheDir: resolve("cache"),',
        'cacheDir: resolve("cache"), vite: { cacheDir: resolve("vite-cache") },',
      )
      .replace(
        "await build({",
        "const astroStart = performance.now();\nawait build({",
      )
      .replace(
        "await indexArticles(",
        'console.error("MEASURE_ASTRO_API_MS=" + (performance.now() - astroStart));\nconst indexStart = performance.now();\nawait indexArticles(',
      ) +
      '\nconsole.error("MEASURE_PAGEFIND_API_MS=" + (performance.now() - indexStart));\n',
  );
  const f = new Fixture(t);
  let manifest = emptyManifest();
  const files: Record<string, Buffer | string> = {};
  const fixtureStarted = performance.now();
  const directory = join(root, "tests/fixtures/production");
  const corpus = readdirSync(directory)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((name) => {
      const baseline = JSON.parse(readFileSync(join(directory, name), "utf8"));
      const bytes = readFileSync(
        join(directory, name.replace(/\.json$/, ".html")),
      );
      assert.equal(sha256(bytes), baseline.sha256);
      manifest = updateCapture(manifest, baseline.source_url, {
        snapshot_sha256: baseline.sha256,
        observed_at: "2026-10-02T06:17:26.000Z",
        discovery_title: "Feed fallback",
        discovery_published_at: null,
      });
      const id = Object.values(manifest.articles).find(
        (a) => a.source_url === baseline.source_url,
      )!.article_id;
      files[`snapshots/${id}.html`] = bytes;
      return { baseline, id };
    });
  files["metadata.json"] = serializeManifest(manifest);
  f.seed(files);
  assert.equal((await f.render()).code, 0);
  const exported = exportArchive(f);
  const archive = join(evidence, "archive");
  cpSync(exported, archive, { recursive: true });
  const fixture_setup_ms = performance.now() - fixtureStarted;
  const before = tree(archive);
  const guard = join(root, "tests/v2/block-network.mjs");
  const log = join(evidence, "network.log");
  writeFileSync(log, "");
  const base = "/copilot-changelog-mirror/";
  const measurements: Record<string, any> = {};
  for (const mode of ["baseline", "replacement"]) {
    const start = performance.now();
    const output = join(evidence, mode);
    const cli =
      mode === "baseline"
        ? join(baselineSource, "src/v2/site-cli.ts")
        : join(root, "src/v2/native-site-cli.ts");
    const args =
      mode === "baseline"
        ? ["build", "--archive", archive, "--source", baselineSource]
        : ["--archive-dir", archive];
    const run = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        guard,
        "--import",
        join(root, "node_modules/tsx/dist/loader.mjs"),
        cli,
        ...args,
        "--output",
        output,
        "--base",
        base,
      ],
      {
        cwd: root,
        env: { ...process.env, COPILOT_NETWORK_LOG: log },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    writeFileSync(join(evidence, `${mode}.log`), run.stderr);
    const result = JSON.parse(run.stdout);
    assert.notEqual(result.outcome, "failure");
    measurements[mode] = {
      total_ms: performance.now() - start,
      ...(mode === "baseline"
        ? {
            astro_api_ms: Number(
              run.stderr.match(/MEASURE_ASTRO_API_MS=(\S+)/)?.[1],
            ),
            pagefind_api_ms: Number(
              run.stderr.match(/MEASURE_PAGEFIND_API_MS=(\S+)/)?.[1],
            ),
          }
        : result.timings),
      astro_invocations: 1,
      pagefind_invocations: 1,
      install_invocations: 0,
    };
    assert.deepEqual(tree(archive), before);
  }
  assert.equal(readFileSync(log, "utf8"), "");
  const differences: any[] = [];
  for (const { id, baseline } of corpus) {
    const route = `/posts/${id.slice(0, -13)}/`;
    const instant = times[id]!;
    assert.ok(instant);
    const oldPage = semanticPage(
      join(evidence, "baseline", route, "index.html"),
      baseline,
      instant,
    );
    const newPage = semanticPage(
      join(evidence, "replacement", route, "index.html"),
      baseline,
      instant,
    );
    for (const key of Object.keys(oldPage) as (keyof typeof oldPage)[]) {
      if (JSON.stringify(oldPage[key]) !== JSON.stringify(newPage[key]))
        differences.push({
          article_id: id,
          route,
          field: key,
          before: oldPage[key],
          after: newPage[key],
        });
    }
  }
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const mode of ["baseline", "replacement"]) {
    const start = performance.now();
    const serving = await serveArtifact(t, join(evidence, mode), base);
    const { context, page } = await openArtifact(browser, serving.origin);
    try {
      await page.goto(serving.url);
      for (const [query, expected] of [
        ["GPT-6.1", "GPT-6.1 Sol in GitHub Copilot"],
        ["multistep", "GPT-6.1 Sol in GitHub Copilot"],
        ["chromesentinel", null],
        ["Mirrored", null],
      ] as const) {
        const queryInput =
          mode === "baseline"
            ? page.getByLabel("Search announcements", { exact: true })
            : page.getByRole("textbox", { name: "Search announcements" });
        await queryInput.fill(query);
        if (mode === "baseline") {
          await expect(page.getByRole("status")).toHaveText(
            expected ? /^1 announcement found/ : /No announcements found/,
          );
          if (expected)
            await expect(page.locator(".search-results a")).toHaveText(
              expected,
            );
        } else if (expected)
          await expect(
            page.locator(".pagefind-ui__result-link").first(),
          ).toHaveText(expected);
        else
          await expect(page.locator(".pagefind-ui__message")).toContainText(
            "No results",
          );
      }
      assert.deepEqual(serving.missing, []);
    } finally {
      await context.close();
    }
    measurements[mode].browser_smoke_ms = performance.now() - start;
  }
  const report = {
    baseline_ref: baselineRef,
    application_revision: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
    })
      .toString()
      .trim(),
    environment: {
      date: "2026-10-14 Asia/Taipei",
      node: process.version,
      npm: execFileSync("npm", ["--version"]).toString().trim(),
      os: `${platform()} ${release()} ${arch()}`,
      lockfile_sha256: sha256(readFileSync(join(root, "package-lock.json"))),
      chromium: browser.version(),
      dependencies:
        "Same preinstalled locked node_modules, no install during either build",
      cache:
        "Fresh per-invocation Astro and Vite cache and output for both paths; warm dependencies/browser; uncontrolled OS page cache",
      concurrency: 1,
      repetitions: 1,
    },
    corpus:
      "Original six saved authentic production articles, one offline Render setup shared by both builds; frozen source-reviewed editorial expectations",
    fixture_setup_ms,
    measurements,
    differences,
    intentional_ui_differences: [
      "Pagefind maintained UI supplies native five-result continuation and section subresults; old UI uses ten-result batches",
      "Visible input label and local-asset failure fallback supplied by small adapter; titles/excerpts otherwise use maintained UI",
      "No JavaScript displays browse fallback without an unusable input",
      "Heading slugs that duplicate explicit archive anchors receive a suffix; original fragments remain unchanged",
    ],
    independence:
      "Pending independent saved-source/difference review; record reviewer findings separately",
    timing_boundaries:
      "Totals comparable end-to-end. Baseline stage numbers are in-process API elapsed times from timing-only worker instrumentation; replacement stage numbers include separate subprocess/CLI startup. Do not compare these boundaries as equivalent API timings.",
  };
  writeFileSync(
    join(evidence, "comparison.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (process.env.COPILOT_SITE_COMPARISON_REPORT)
    writeFileSync(
      resolve(process.env.COPILOT_SITE_COMPARISON_REPORT),
      JSON.stringify(report, null, 2) + "\n",
    );
  t.diagnostic(JSON.stringify(measurements));
});
