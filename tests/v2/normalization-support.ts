import { emptyManifest, sha256, updateCapture } from "../../src/v2/domain.js";
import { normalizeArticle } from "../../src/v2/normalize.js";

/** Saved-source seam shared by the active production and directory normalizer. */
export function savedNormalization(
  html: string,
  source = "https://github.blog/changelog/article/",
  title = " Feed title ",
  time: string | null = "2026-09-01T00:00:00.000Z",
) {
  const bytes = Buffer.from(html);
  const manifest = updateCapture(emptyManifest(), source, {
    snapshot_sha256: sha256(bytes),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: title,
    discovery_published_at: time,
  });
  return normalizeArticle(bytes, Object.values(manifest.articles)[0]!);
}
