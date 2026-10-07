import { execFile, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { TestContext } from "node:test";
import {
  emptyManifest,
  serializeManifest,
  sha256,
  updateCapture,
} from "../../src/v2/domain.js";

const run = promisify(execFile);
export const root = resolve(import.meta.dirname, "../..");

export class Fixture {
  readonly dir = mkdtempSync(join(tmpdir(), "copilot-v2-test-"));
  readonly repo = join(this.dir, "repo");
  readonly sources = join(this.dir, "sources");
  readonly temporary = join(this.dir, "temporary");
  readonly branch = "v2-fixture";
  constructor(t: TestContext) {
    t.after(() => rmSync(this.dir, { recursive: true, force: true }));
    mkdirSync(this.repo);
    mkdirSync(this.sources);
    mkdirSync(this.temporary);
    this.git("init", "-q", "-b", "main");
    this.git("config", "user.name", "Fixture");
    this.git("config", "user.email", "fixture@example.invalid");
    writeFileSync(join(this.repo, "app.txt"), "application\n");
    this.git("add", ".");
    this.git("commit", "-qm", "initial");
  }
  git(...args: string[]): Buffer {
    return execFileSync("git", ["-C", this.repo, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
  text(...args: string[]): string {
    return this.git(...args)
      .toString()
      .trim();
  }
  tip(): string {
    return this.text("rev-parse", this.branch);
  }
  manifest(): any {
    return JSON.parse(
      this.git("show", `${this.branch}:metadata.json`).toString(),
    );
  }
  source(name: string, bytes: Buffer | string): string {
    const path = join(this.sources, name);
    writeFileSync(path, bytes);
    return pathToFileURL(path).href;
  }
  feed(items: string): string {
    return this.source("feed.xml", `<rss><channel>${items}</channel></rss>`);
  }
  async cli(
    feedUrl?: string,
    extra: string[] = [],
    env: NodeJS.ProcessEnv = {},
    command = "capture",
  ): Promise<{ code: number; stdout: string; stderr: string; result: any }> {
    const log = join(this.dir, "network-attempts.log");
    rmSync(log, { force: true });
    let result;
    try {
      const output = await run(
        process.execPath,
        [
          ...(command === "render"
            ? ["--import", join(root, "tests/v2/block-network.mjs")]
            : []),
          "--import",
          "tsx",
          join(root, "src/v2/cli.ts"),
          command,
          "--repo",
          this.repo,
          "--data-branch",
          this.branch,
          ...(feedUrl ? ["--feed-url", feedUrl] : []),
          ...extra,
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            COPILOT_CAPTURE_NOW: "2026-10-06T12:00:00.000Z",
            TMPDIR: this.temporary,
            ...env,
            COPILOT_NETWORK_LOG: log,
          },
        },
      );
      result = { code: 0, ...output, result: JSON.parse(output.stdout) };
    } catch (error: any) {
      result = {
        code: error.code,
        stdout: error.stdout,
        stderr: error.stderr,
        result: error.stdout ? JSON.parse(error.stdout) : null,
      };
    }
    assert.equal(
      existsSync(log) ? readFileSync(log, "utf8") : "",
      "",
      "Offline render attempted network access, even if caught by the CLI",
    );
    return result;
  }
  render(extra: string[] = [], env: NodeJS.ProcessEnv = {}) {
    return this.cli(undefined, extra, env, "render");
  }
  seed(
    files: Record<string, string | Buffer>,
    links: Record<string, string> = {},
    remove: string[] = [],
  ): void {
    const worktree = join(this.dir, "seed");
    let exists = true;
    try {
      this.tip();
    } catch {
      exists = false;
    }
    this.git(
      "worktree",
      "add",
      ...(exists ? [] : ["--detach"]),
      worktree,
      exists ? this.branch : "HEAD",
    );
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", worktree, ...args], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    try {
      if (!exists) git("switch", "--orphan", this.branch);
      for (const path of remove) rmSync(join(worktree, path), { force: true });
      for (const [path, bytes] of Object.entries(files)) {
        mkdirSync(resolve(worktree, path, ".."), { recursive: true });
        writeFileSync(join(worktree, path), bytes);
      }
      for (const [path, target] of Object.entries(links)) {
        mkdirSync(resolve(worktree, path, ".."), { recursive: true });
        rmSync(join(worktree, path), { force: true });
        symlinkSync(target, join(worktree, path));
      }
      git("add", "-A");
      git("commit", "--allow-empty", "-qm", "seed archive");
    } finally {
      this.git("worktree", "remove", worktree);
    }
  }
}

export function seedArticle(
  f: Fixture,
  html: string,
  source = "https://github.blog/changelog/article/",
  title = " Feed title ",
  time: string | null = "2026-09-01T00:00:00.000Z",
) {
  const manifest = updateCapture(emptyManifest(), source, {
    snapshot_sha256: sha256(html),
    observed_at: "2026-10-01T00:00:00.000Z",
    discovery_title: title,
    discovery_published_at: time,
  });
  const id = Object.keys(manifest.articles)[0]!;
  f.seed({
    "metadata.json": serializeManifest(manifest),
    [`snapshots/${id}.html`]: html,
  });
  return id;
}

export async function serve(
  t: TestContext,
  handler: import("node:http").RequestListener,
): Promise<string> {
  const { createServer } = await import("node:http");
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const address = server.address() as import("node:net").AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
