import { execFile } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { TestContext } from "node:test";
import {
  articleIdentity,
  emptyManifest,
  serializeManifest,
  sha256,
} from "../../src/v2/domain.js";
import type { Manifest } from "../../src/v2/domain.js";
import { root } from "./support.js";

export class NativeSiteFixture {
  readonly dir = mkdtempSync(join(tmpdir(), "copilot-native-site-"));
  readonly archive = join(this.dir, "archive");
  constructor(t: TestContext) {
    mkdirSync(this.archive);
    t.after(() => rmSync(this.dir, { recursive: true, force: true }));
  }
  // Synthetic canonical gap inputs; authentic extracts are prepared separately.
  seed(
    records: {
      slug: string;
      title?: string;
      body?: string;
      time?: string | null;
      source?: string;
    }[] = [],
  ) {
    const manifest = emptyManifest();
    mkdirSync(join(this.archive, "posts"), { recursive: true });
    for (const record of records) {
      const identity = articleIdentity(
        record.source ?? `https://github.blog/changelog/${record.slug}/`,
      );
      manifest.articles[identity.article_id] = {
        ...identity,
        capture: {
          snapshot_sha256: sha256("saved raw evidence"),
          observed_at: "2026-10-01T00:00:00.000Z",
          discovery_title: "discoverysentinel",
          discovery_published_at: null,
        },
        canonical: {
          title: record.title ?? record.slug,
          published_at: record.time ?? null,
          publication_path: `/posts/${record.slug}/`,
        },
      };
      writeFileSync(
        join(this.archive, "posts", `${identity.article_id}.md`),
        record.body ?? "Canonical body.\n",
      );
    }
    this.writeManifest(manifest);
    return manifest;
  }
  writeManifest(manifest: Manifest) {
    writeFileSync(
      join(this.archive, "metadata.json"),
      serializeManifest(manifest),
    );
  }
  async cli(
    extra: string[] = [],
    env: NodeJS.ProcessEnv = {},
    imports: string[] = [],
  ) {
    const toolLog = join(this.dir, "tool-starts.log");
    writeFileSync(toolLog, "");
    const toolCounts = () => {
      const starts = readFileSync(toolLog, "utf8").trim().split("\n");
      return {
        astro: starts.filter((stage) => stage === "astro").length,
        pagefind: starts.filter((stage) => stage === "pagefind").length,
      };
    };
    try {
      const output = await promisify(execFile)(
        process.execPath,
        [
          ...imports.flatMap((p) => ["--import", p]),
          "--import",
          join(root, "tests/v2/native-site-observer.mjs"),
          "--import",
          "tsx",
          join(root, "src/v2/native-site-cli.ts"),
          "--archive-dir",
          this.archive,
          "--output",
          join(this.dir, "output"),
          ...extra,
        ],
        {
          cwd: root,
          env: { ...process.env, ...env, COPILOT_TOOL_LOG: toolLog },
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      return {
        code: 0,
        ...output,
        result: JSON.parse(output.stdout),
        tool_counts: toolCounts(),
      };
    } catch (error: any) {
      return {
        code: error.code,
        tool_counts: toolCounts(),
        stdout: error.stdout,
        stderr: error.stderr,
        result: error.stdout ? JSON.parse(error.stdout) : null,
      };
    }
  }
}
