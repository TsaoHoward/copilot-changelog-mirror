import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, readManifest, validateArchive } from "./domain.js";
import type { ArchiveFiles, Manifest } from "./domain.js";

export interface ArchiveInput {
  revision: string | null;
  localRevision: string | null;
  manifest: Manifest;
  files: ArchiveFiles;
}

/** Git plumbing never checks out the archive or uses the application's index. */
export class GitArchive {
  private readonly env: NodeJS.ProcessEnv;
  readonly ref: string;
  constructor(
    readonly repo: string,
    readonly branch: string,
  ) {
    this.ref = `refs/heads/${branch}`;
    this.env = { ...process.env };
    for (const key of Object.keys(this.env))
      if (key.startsWith("GIT_")) delete this.env[key];
  }
  private git(
    args: string[],
    options: { input?: Buffer | string; index?: string } = {},
  ): Buffer {
    try {
      return execFileSync("git", ["-C", this.repo, ...args], {
        env: {
          ...this.env,
          ...(options.index ? { GIT_INDEX_FILE: options.index } : {}),
        },
        ...(options.input === undefined ? {} : { input: options.input }),
        maxBuffer: 128 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      const failure = error as Error & { stderr?: Buffer };
      throw new Error(
        `Git ${args[0]} failed: ${failure.stderr?.toString().trim() || failure.message}`,
      );
    }
  }
  private optionalRef(ref: string): string | null {
    const lines = this.git([
      "for-each-ref",
      "--format=%(refname) %(objectname)",
      ref,
    ])
      .toString()
      .trim()
      .split("\n");
    const exact = lines.find((line) => line.startsWith(`${ref} `));
    return exact ? exact.slice(ref.length + 1) : null;
  }
  assertSafeTarget(): void {
    this.git(["check-ref-format", this.ref]);
    const worktrees = this.git(["worktree", "list", "--porcelain"]).toString();
    if (worktrees.split("\n").includes(`branch ${this.ref}`))
      throw new Error(
        `Archive branch is checked out in a user worktree: ${this.branch}`,
      );
    const defaults = new Set([
      "main",
      "master",
      this.git(["config", "--default", "main", "--get", "init.defaultBranch"])
        .toString()
        .trim(),
    ]);
    const remoteHeads = this.git([
      "for-each-ref",
      "--format=%(refname) %(symref)",
      "refs/remotes",
    ]).toString();
    for (const line of remoteHeads.split("\n")) {
      const [ref, target] = line.split(" ");
      if (ref?.endsWith("/HEAD") && target)
        defaults.add(target.split("/").slice(3).join("/"));
    }
    const symbolic = this.git([
      "for-each-ref",
      "--format=%(refname) %(symref)",
      this.ref,
    ])
      .toString()
      .trim();
    if (
      symbolic.startsWith(`${this.ref} `) &&
      symbolic.slice(this.ref.length + 1)
    )
      throw new Error("Archive target must not be a symbolic branch");
    if (defaults.has(this.branch))
      throw new Error(
        `Cannot target the application/default branch: ${this.branch}`,
      );
  }
  read(): ArchiveInput {
    this.assertSafeTarget();
    const localRevision = this.optionalRef(this.ref);
    const revision =
      localRevision ?? this.optionalRef(`refs/remotes/origin/${this.branch}`);
    const files: ArchiveFiles = new Map();
    if (revision) {
      for (const entry of this.git(["ls-tree", "-rz", revision])
        .toString()
        .split("\0")
        .filter(Boolean)) {
        const match = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(entry);
        if (!match || match[2] !== "blob")
          throw new Error(`Non-regular archive object: ${entry}`);
        const [, mode, , oid, path] = match;
        files.set(path!, {
          mode: mode!,
          bytes: this.git(["cat-file", "blob", oid!]),
        });
      }
    }
    const metadata = files.get("metadata.json");
    if (!metadata && files.size)
      throw new Error(
        "Archive lacks v2 metadata.json; legacy/application state requires explicit reset/cutover.",
      );
    const manifest = metadata ? readManifest(metadata.bytes) : emptyManifest();
    validateArchive(manifest, files);
    return { revision, localRevision, manifest, files };
  }
  async commit(input: ArchiveInput, files: ArchiveFiles): Promise<string> {
    const temporary = await mkdtemp(join(tmpdir(), "copilot-capture-"));
    const index = join(temporary, "index");
    let revision: string;
    try {
      this.git(["read-tree", input.revision ?? "--empty"], { index });
      for (const [path, file] of files) {
        if (input.files.get(path)?.bytes.equals(file.bytes)) continue;
        const oid = this.git(["hash-object", "-w", "--stdin"], {
          input: file.bytes,
        })
          .toString()
          .trim();
        this.git(
          ["update-index", "--add", "--cacheinfo", file.mode, oid, path],
          { index },
        );
      }
      const tree = this.git(["write-tree"], { index }).toString().trim();
      revision = this.git([
        "commit-tree",
        tree,
        ...(input.revision ? ["-p", input.revision] : []),
        "-m",
        "Capture v2 raw evidence",
      ])
        .toString()
        .trim();
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    // Cleanup and validation must succeed before the only visible archive mutation.
    this.assertSafeTarget();
    const zero = "0".repeat(revision.length);
    this.git([
      "update-ref",
      "--no-deref",
      this.ref,
      revision,
      input.localRevision ?? zero,
    ]);
    return revision;
  }
}
