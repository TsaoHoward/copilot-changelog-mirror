import { isDeepStrictEqual } from "node:util";
import { GitArchive } from "./archive.js";
import { normalizeArticle } from "./normalize.js";
import {
  comparePublications,
  publicationProjection,
  serializeManifest,
  updateRender,
  validateArchive,
  validateTransition,
} from "./domain.js";
import type { ArchiveFiles, Manifest } from "./domain.js";
import type { CaptureFailure } from "./capture.js";

export interface RenderOptions {
  repo: string;
  branch: string;
}
export interface RenderSuccess {
  outcome: "changed" | "no-change";
  archive_input: string;
  archive_output: string;
  counts: { rendered: number; updated: number; unchanged: number };
  publication_input: string | null;
  publication_output: string;
  publication_outcome: "initialized" | "changed" | "no-change";
}
export type RenderResult = RenderSuccess | CaptureFailure;

function bodies(manifest: Manifest, files: ArchiveFiles): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of Object.keys(manifest.articles)) {
    const file = files.get(`posts/${id}.md`);
    if (file)
      result.set(
        id,
        new TextDecoder("utf-8", { fatal: true }).decode(file.bytes),
      );
  }
  return result;
}

export async function render(options: RenderOptions): Promise<RenderResult> {
  let archive_input: string | null = null;
  try {
    const archive = new GitArchive(options.repo, options.branch);
    const input = archive.read((revision) => {
      archive_input = revision;
    });
    archive_input = input.revision;
    if (!input.revision || !input.files.has("metadata.json"))
      throw new Error("No persisted v2 archive input; run capture first.");
    const previous = publicationProjection(
      input.manifest,
      bodies(input.manifest, input.files),
    );
    const files = new Map(input.files);
    let manifest = input.manifest;
    const counts = { rendered: 0, updated: 0, unchanged: 0 };
    for (const id of Object.keys(input.manifest.articles).sort()) {
      const article = input.manifest.articles[id]!;
      try {
        const normalized = normalizeArticle(
          files.get(`snapshots/${id}.html`)!.bytes,
          article,
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
    const candidate = publicationProjection(manifest, bodies(manifest, files));
    if (candidate === null)
      throw new Error("Incomplete rendered publication state");
    const publication = comparePublications(previous, candidate);
    if (!changed) archive.confirm(input);
    const output = changed
      ? await archive.commit(input, files, "Render v2 canonical publication")
      : input.revision;
    return {
      outcome: changed ? "changed" : "no-change",
      archive_input: input.revision,
      archive_output: output,
      counts,
      ...publication,
    };
  } catch (error) {
    return {
      outcome: "failure",
      archive_input,
      archive_output: null,
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }
}
