import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { TestContext } from "node:test";
import type { Browser } from "@playwright/test";
import { serve } from "./support.js";

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
