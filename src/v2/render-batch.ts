import { isDeepStrictEqual } from "node:util";
import { normalizeArticle } from "./normalize.js";
import {
  serializeManifest,
  updateRender,
  validateArchive,
  validateTransition,
} from "./domain.js";
import type { ArchiveFiles, Manifest } from "./domain.js";

export function renderBatch(
  input: { manifest: Manifest; files: ArchiveFiles },
  requireEditorialRoot = false,
) {
  const files = new Map(input.files);
  let manifest = input.manifest;
  const counts = { rendered: 0, updated: 0, unchanged: 0 };
  for (const id of Object.keys(input.manifest.articles).sort()) {
    const article = input.manifest.articles[id]!;
    try {
      const normalized = normalizeArticle(
        files.get(`snapshots/${id}.html`)!.bytes,
        article,
        { requireEditorialRoot },
      );
      manifest = updateRender(manifest, id, normalized.canonical);
      const path = `posts/${id}.md`;
      const body = Buffer.from(normalized.body);
      counts.rendered++;
      if (
        isDeepStrictEqual(article.canonical, normalized.canonical) &&
        files.get(path)?.bytes.equals(body)
      )
        counts.unchanged++;
      else {
        counts.updated++;
        files.set(path, {
          mode: files.get(path)?.mode ?? "100644",
          bytes: body,
        });
      }
    } catch (error) {
      throw new Error(
        `Article ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  validateTransition(input.manifest, manifest, "render");
  const changed = counts.updated > 0;
  if (changed)
    files.set("metadata.json", {
      mode: input.files.get("metadata.json")!.mode,
      bytes: Buffer.from(serializeManifest(manifest)),
    });
  validateArchive(manifest, files);
  for (const [id, article] of Object.entries(manifest.articles))
    if (!article.canonical || !files.has(`posts/${id}.md`))
      throw new Error(`Incomplete rendered article: ${id}`);
  return { manifest, files, counts, changed };
}
