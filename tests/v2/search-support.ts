import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { TestContext } from "node:test";
import type { Browser } from "@playwright/test";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";
import { Fixture, serve } from "./support.js";
import { exportArchive, siteCommand } from "./site-support.js";

export async function seedCorpus(
  f: Fixture,
  records: { slug: string; title: string; body: string }[],
) {
  let manifest = emptyManifest();
  const files: Record<string, string> = {};
  for (const record of records) {
    const html = `<aside>chromesentinel</aside><article><h1>${record.title}</h1><p>${record.body}</p></article>`;
    const source = `https://github.blog/changelog/${record.slug}/`;
    manifest = updateCapture(manifest, source, {
      snapshot_sha256: sha256(html),
      observed_at: "2026-10-01T00:00:00.000Z",
      discovery_title: "discoverysentinel",
      discovery_published_at: null,
    });
    const article = Object.values(manifest.articles).find(
      (a) => a.source_url === source,
    )!;
    files[`snapshots/${article.article_id}.html`] = html;
  }
  files["metadata.json"] = serializeManifest(manifest);
  f.seed(files);
  assert.equal((await f.render()).code, 0);
}

export function tree(directory: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      Object.assign(files, tree(path, `${prefix}${entry.name}/`));
    else files[`${prefix}${entry.name}`] = readFileSync(path).toString("hex");
  }
  return files;
}

export async function buildCorpus(f: Fixture, name: string, base: string) {
  const archive = exportArchive(f, `${name}-archive`);
  const before = tree(archive);
  const revision = f.tip();
  const output = join(f.dir, name);
  const built = await siteCommand(f, archive, "build", [
    "--output",
    output,
    "--base",
    base,
  ]);
  assert.equal(built.code, 0, built.stderr);
  assert.equal(f.tip(), revision);
  assert.deepEqual(tree(archive), before);
  return { output, result: built.result };
}

export async function serveArtifact(
  t: TestContext,
  output: string,
  base: string,
) {
  const missing: string[] = [];
  const origin = await serve(t, (req, res) => {
    const url = new URL(req.url!, "http://local");
    try {
      assert.ok(url.pathname.startsWith(base));
      const relative = decodeURIComponent(url.pathname.slice(base.length));
      const path = resolve(
        output,
        relative.endsWith("/") || !relative
          ? `${relative}index.html`
          : relative,
      );
      assert.ok(path.startsWith(`${output}${sep}`));
      res.setHeader(
        "Content-Type",
        /\.[cm]?js$/.test(path)
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".html")
              ? "text/html"
              : path.endsWith(".wasm")
                ? "application/wasm"
                : path.endsWith(".json")
                  ? "application/json"
                  : "application/octet-stream",
      );
      res.end(readFileSync(path));
    } catch {
      missing.push(url.pathname);
      res.writeHead(404).end();
    }
  });
  return { origin, url: origin + base, missing };
}

export async function openArtifact(
  browser: Browser,
  origin: string,
  options: {
    javaScriptEnabled?: boolean;
    viewport?: { width: number; height: number };
  } = {},
) {
  const context = await browser.newContext(options);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  return { context, page: await context.newPage() };
}
