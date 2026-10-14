import { lstat, readFile } from "node:fs/promises";
import { join, resolve, parse, sep } from "node:path";
import {
  readManifest,
  publicationProjection,
  publicationPath,
} from "./domain.js";
import type { PublicationProjection } from "./domain.js";

/** Reject aliases along managed paths, including existing ancestors of a new output. */
export async function assertRegularPath(
  path: string,
  kind: "file" | "directory",
  allowMissing = false,
): Promise<void> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const segments = absolute.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    current = join(current, segments[i]!);
    let info;
    try {
      info = await lstat(current);
    } catch (error: any) {
      if (allowMissing && error.code === "ENOENT") return;
      throw new Error(`Unreadable ${kind}: ${current}: ${error.message}`);
    }
    const expected = i === segments.length - 1 ? kind : "directory";
    if (expected === "directory" ? !info.isDirectory() : !info.isFile())
      throw new Error(
        `Managed ${expected} must be regular, not a symlink/nonregular object: ${current}`,
      );
  }
}

/** Read only canonical metadata and its required bodies. Raw evidence belongs to Render. */
export async function loadDerivedPublication(
  directory: string,
): Promise<PublicationProjection> {
  await assertRegularPath(directory, "directory");
  const metadata = join(directory, "metadata.json");
  await assertRegularPath(metadata, "file");
  const manifest = readManifest(await readFile(metadata));
  const bodies = new Map<string, string>();
  const routes = new Set<string>();
  for (const article of Object.values(manifest.articles)) {
    if (!article.canonical)
      throw new Error(
        `Incomplete canonical publication: ${article.article_id}; run offline Render first`,
      );
    const route = article.canonical.publication_path;
    if (route !== publicationPath(article.source_url))
      throw new Error(`Source-derived route mismatch: ${article.article_id}`);
    if (routes.has(route))
      throw new Error(`Publication route collision: ${route}`);
    routes.add(route);
    const path = join(directory, "posts", `${article.article_id}.md`);
    await assertRegularPath(path, "file");
    let body: string;
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(
        await readFile(path),
      );
    } catch (error: any) {
      throw new Error(`Unreadable UTF-8 body ${path}: ${error.message}`);
    }
    if (/^---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)(?:\r?\n|$)/.test(body))
      throw new Error(
        `Legacy front matter is not valid canonical body content: ${path}`,
      );
    bodies.set(article.article_id, body);
  }
  return publicationProjection(manifest, bodies)!;
}
