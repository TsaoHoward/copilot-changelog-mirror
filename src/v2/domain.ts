import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { parseTree } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";

export interface Identity {
  article_id: string;
  source_url: string;
}
export interface CaptureObservation {
  snapshot_sha256: string;
  observed_at: string;
  discovery_title: string;
  discovery_published_at: string | null;
}
export interface Canonical {
  title: string;
  published_at: string | null;
  publication_path: string;
}
export interface Article extends Identity {
  capture: CaptureObservation;
  canonical: Canonical | null;
}
export interface Manifest {
  schema_version: 2;
  articles: Record<string, Article>;
}

export const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");
export const emptyManifest = (): Manifest => ({
  schema_version: 2,
  articles: {},
});

export function normalizeSourceUrl(input: string, base?: string): string {
  const url = new URL(input, base);
  if (!["https:", "http:", "file:"].includes(url.protocol)) {
    throw new Error(`Unsupported source URL protocol: ${url.protocol}`);
  }
  url.hash = "";
  return url.href;
}

export function articleIdentity(input: string): Identity {
  const source_url = normalizeSourceUrl(input);
  const segment =
    new URL(source_url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const slug =
    decodeURIComponent(segment)
      .replace(/\.[a-zA-Z0-9]{1,8}$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .toLowerCase() || "article";
  return {
    article_id: `${slug}-${sha256(source_url).slice(0, 12)}`,
    source_url,
  };
}

export function updateCapture(
  manifest: Manifest,
  sourceUrl: string,
  capture: CaptureObservation,
): Manifest {
  validateManifest(manifest);
  validateCapture(capture);
  const identity = articleIdentity(sourceUrl);
  const previous = manifest.articles[identity.article_id];
  if (previous && previous.source_url !== identity.source_url)
    throw new Error(`Article identity collision: ${identity.article_id}`);
  const candidate: Manifest = {
    schema_version: 2,
    articles: {
      ...manifest.articles,
      [identity.article_id]: {
        ...identity,
        capture: { ...capture },
        canonical: previous?.canonical ? { ...previous.canonical } : null,
      },
    },
  };
  validateTransition(manifest, candidate, "capture");
  return candidate;
}

export function updateRender(
  manifest: Manifest,
  articleId: string,
  canonical: Canonical,
): Manifest {
  validateManifest(manifest);
  validateCanonical(canonical);
  const previous = manifest.articles[articleId];
  if (!previous)
    throw new Error(`Cannot render unknown article identity: ${articleId}`);
  const candidate: Manifest = {
    schema_version: 2,
    articles: {
      ...manifest.articles,
      [articleId]: {
        ...previous,
        capture: { ...previous.capture },
        canonical: { ...canonical },
      },
    },
  };
  validateTransition(manifest, candidate, "render");
  return candidate;
}

export function validateTransition(
  previous: Manifest,
  candidate: Manifest,
  stage: "capture" | "render",
): void {
  validateManifest(previous);
  validateManifest(candidate);
  for (const [id, before] of Object.entries(previous.articles)) {
    const after = candidate.articles[id];
    if (
      !after ||
      before.article_id !== after.article_id ||
      before.source_url !== after.source_url
    ) {
      throw new Error(`Cannot delete or change immutable identity: ${id}`);
    }
    const ownedByOther = stage === "capture" ? "canonical" : "capture";
    if (!isDeepStrictEqual(before[ownedByOther], after[ownedByOther])) {
      throw new Error(
        `${stage} ownership violation: cannot change ${ownedByOther} for ${id}`,
      );
    }
  }
  for (const [id, article] of Object.entries(candidate.articles)) {
    if (
      !Object.hasOwn(previous.articles, id) &&
      (stage !== "capture" || article.canonical !== null)
    ) {
      throw new Error(
        `Only capture can create a new identity with null canonical state: ${id}`,
      );
    }
  }
}

function record(
  value: unknown,
  name: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object`);
}

function fields(
  value: unknown,
  expected: string[],
  name: string,
): asserts value is Record<string, unknown> {
  record(value, name);
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new Error(
      `${name} has missing or unknown fields; expected ${expected.join(", ")}`,
    );
  }
}

function string(
  value: unknown,
  name: string,
  nonempty = false,
): asserts value is string {
  if (typeof value !== "string" || (nonempty && !value.trim()))
    throw new Error(`${name} must be ${nonempty ? "a non-empty" : "a"} string`);
}

function instant(value: unknown, name: string, nullable = false): void {
  if (nullable && value === null) return;
  string(value, name);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(
      `${name} must be a valid UTC instant with millisecond precision ending in Z`,
    );
  }
}

function validateCapture(value: unknown): asserts value is CaptureObservation {
  fields(
    value,
    [
      "snapshot_sha256",
      "observed_at",
      "discovery_title",
      "discovery_published_at",
    ],
    "capture",
  );
  string(value.snapshot_sha256, "snapshot_sha256");
  if (!/^[a-f0-9]{64}$/.test(value.snapshot_sha256))
    throw new Error("snapshot_sha256 must be a lowercase SHA-256 hash");
  instant(value.observed_at, "observed_at");
  string(value.discovery_title, "discovery_title");
  instant(value.discovery_published_at, "discovery_published_at", true);
}

function validateCanonical(value: unknown): asserts value is Canonical {
  fields(value, ["title", "published_at", "publication_path"], "canonical");
  string(value.title, "canonical.title", true);
  string(value.publication_path, "publication_path", true);
  instant(value.published_at, "canonical.published_at", true);
}

export function validateManifest(value: unknown): asserts value is Manifest {
  fields(value, ["schema_version", "articles"], "manifest");
  if (value.schema_version !== 2)
    throw new Error(
      "Unsupported schema_version; expected v2. Legacy state requires explicit reset/cutover.",
    );
  record(value.articles, "articles");
  const sources = new Set<string>();
  for (const [id, article] of Object.entries(value.articles)) {
    fields(
      article,
      ["article_id", "source_url", "capture", "canonical"],
      `article ${id}`,
    );
    string(article.source_url, "source_url");
    string(article.article_id, "article_id");
    const identity = articleIdentity(article.source_url);
    if (
      article.source_url !== identity.source_url ||
      id !== identity.article_id ||
      article.article_id !== id
    ) {
      throw new Error(`Immutable identity/key/source_url mismatch for ${id}`);
    }
    if (sources.has(article.source_url))
      throw new Error(`Duplicate source identity: ${article.source_url}`);
    sources.add(article.source_url);
    validateCapture(article.capture);
    if (article.canonical !== null) validateCanonical(article.canonical);
  }
}

export function readManifest(input: string | Uint8Array): Manifest {
  const text =
    typeof input === "string"
      ? input
      : new TextDecoder("utf-8", { fatal: true }).decode(input);
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
  });
  if (!tree || errors.length) throw new Error("Invalid metadata.json JSON");
  function checkDuplicates(node: JsonNode): void {
    if (node.type === "object") {
      const keys = new Set<string>();
      for (const property of node.children ?? []) {
        const key = property.children![0]!.value as string;
        if (keys.has(key)) throw new Error(`Duplicate JSON key: ${key}`);
        keys.add(key);
      }
    }
    node.children?.forEach(checkDuplicates);
  }
  checkDuplicates(tree);
  const manifest: unknown = JSON.parse(text);
  validateManifest(manifest);
  return manifest;
}

export function serializeManifest(manifest: Manifest): string {
  validateManifest(manifest);
  const articles: Record<string, Article> = {};
  for (const id of Object.keys(manifest.articles).sort()) {
    const article = manifest.articles[id]!;
    articles[id] = {
      article_id: article.article_id,
      source_url: article.source_url,
      capture: {
        snapshot_sha256: article.capture.snapshot_sha256,
        observed_at: article.capture.observed_at,
        discovery_title: article.capture.discovery_title,
        discovery_published_at: article.capture.discovery_published_at,
      },
      canonical:
        article.canonical === null
          ? null
          : {
              title: article.canonical.title,
              published_at: article.canonical.published_at,
              publication_path: article.canonical.publication_path,
            },
    };
  }
  return JSON.stringify({ schema_version: 2, articles }, null, 2) + "\n";
}

export interface ArchiveFile {
  mode: string;
  bytes: Buffer;
}
export type ArchiveFiles = Map<string, ArchiveFile>;

/** The file collection is part of the archive contract, independent of Git transport. */
export function validateArchive(manifest: Manifest, files: ArchiveFiles): void {
  validateManifest(manifest);
  const metadata = files.get("metadata.json");
  if (metadata && !isDeepStrictEqual(readManifest(metadata.bytes), manifest))
    throw new Error(
      "Persisted metadata.json does not match candidate manifest",
    );
  const allowed = new Set(["metadata.json"]);
  for (const article of Object.values(manifest.articles)) {
    const snapshot = `snapshots/${article.article_id}.html`;
    allowed.add(snapshot);
    allowed.add(`posts/${article.article_id}.md`);
    const file = files.get(snapshot);
    if (!file) throw new Error(`Missing referenced snapshot: ${snapshot}`);
    if (!["100644", "100755"].includes(file.mode))
      throw new Error(`Snapshot must be a regular file: ${snapshot}`);
    if (sha256(file.bytes) !== article.capture.snapshot_sha256)
      throw new Error(`Snapshot/hash mismatch: ${snapshot}`);
  }
  for (const [path, file] of files) {
    if (!allowed.has(path) || !["100644", "100755"].includes(file.mode)) {
      throw new Error(
        `Invalid v2 archive object: ${path}. Legacy/application state requires explicit reset/cutover.`,
      );
    }
    if (
      path.startsWith("posts/") &&
      /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.test(
        file.bytes.toString("utf8"),
      )
    ) {
      throw new Error(
        `Legacy front matter is not valid v2 canonical content: ${path}; use explicit reset/cutover.`,
      );
    }
  }
}
