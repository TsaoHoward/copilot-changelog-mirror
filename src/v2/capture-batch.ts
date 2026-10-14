import { isDeepStrictEqual } from "node:util";
import { acquire, discover } from "./discovery.js";
import {
  articleIdentity,
  serializeManifest,
  sha256,
  updateCapture,
  validateArchive,
  validateTransition,
} from "./domain.js";

import type { ArchiveFiles, Manifest } from "./domain.js";

export async function captureBatch(
  input: { manifest: Manifest; files: ArchiveFiles },
  options: { feedUrl: string; timeoutMs?: number; now?: () => Date },
) {
  const timeout = options.timeoutMs ?? 30_000;
  const articles = discover(
    await acquire(options.feedUrl, timeout),
    options.feedUrl,
  );
  const files = new Map(input.files);
  let manifest = input.manifest;
  const counts = { created: 0, updated: 0, unchanged: 0 };
  let changed = !input.files.has("metadata.json");
  for (const article of articles) {
    const identity = articleIdentity(article.source_url);
    const bytes = await acquire(article.source_url, timeout);
    const observedAt = (options.now ?? (() => new Date()))().toISOString();
    const hash = sha256(bytes);
    const previous = manifest.articles[identity.article_id];
    const observation = {
      snapshot_sha256: hash,
      observed_at:
        previous?.capture.snapshot_sha256 === hash
          ? previous.capture.observed_at
          : observedAt,
      discovery_title: article.title,
      discovery_published_at: article.published_at,
    };
    const candidate = updateCapture(manifest, article.source_url, observation);
    if (previous && isDeepStrictEqual(previous.capture, observation)) {
      counts.unchanged++;
      continue;
    }
    manifest = candidate;
    const snapshot = `snapshots/${identity.article_id}.html`;
    files.set(snapshot, {
      mode: input.files.get(snapshot)?.mode ?? "100644",
      bytes,
    });
    if (previous) counts.updated++;
    else counts.created++;
    changed = true;
  }
  validateTransition(input.manifest, manifest, "capture");
  if (changed)
    files.set("metadata.json", {
      mode: input.files.get("metadata.json")?.mode ?? "100644",
      bytes: Buffer.from(serializeManifest(manifest)),
    });
  validateArchive(manifest, files);
  return { manifest, files, counts, changed };
}
