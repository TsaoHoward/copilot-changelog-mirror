import { execFileSync } from "node:child_process";
import {
  lstat,
  readdir,
  readFile,
  realpath,
  mkdtemp,
  mkdir,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep, isAbsolute } from "node:path";
import {
  emptyManifest,
  readManifest,
  validateArchive,
  publicationPath,
} from "./domain.js";
import type { ArchiveFiles, Manifest } from "./domain.js";

export interface DirectoryInput {
  manifest: Manifest;
  files: ArchiveFiles;
}
export type DirectoryResult<Counts> =
  | { outcome: "changed" | "no-change"; counts: Counts }
  | { outcome: "failure"; diagnostic: string };

/** Routes must already be unambiguous while new identities still have null canonical state. */
export function validateDirectoryArchive(input: DirectoryInput): void {
  validateArchive(input.manifest, input.files);
  const routes = new Set<string>();
  for (const article of Object.values(input.manifest.articles)) {
    const path = publicationPath(article.source_url);
    if (article.canonical && article.canonical.publication_path !== path)
      throw new Error(`Source-derived route mismatch: ${article.article_id}`);
    if (routes.has(path))
      throw new Error(`Publication route collision: ${path}`);
    routes.add(path);
  }
}

/** Only read-only Git inspection; persistence belongs to the operator. */
export class DirectoryArchive {
  private readonly env = { ...process.env };
  readonly path: string;
  constructor(path: string) {
    if (!path.trim()) throw new Error("--archive-dir PATH is required");
    this.path = resolve(path);
    for (const key of Object.keys(this.env))
      if (key.startsWith("GIT_")) delete this.env[key];
    this.env.GIT_OPTIONAL_LOCKS = "0";
  }
  private git(...args: string[]): string {
    try {
      return execFileSync("git", ["-C", this.path, ...args], {
        env: this.env,
        stdio: ["pipe", "pipe", "pipe"],
      })
        .toString()
        .trim();
    } catch (error) {
      const failure = error as Error & { stderr?: Buffer };
      throw new Error(
        `Archive Git inspection failed: ${failure.stderr?.toString().trim() || failure.message}`,
      );
    }
  }
  async assertSafeTarget(): Promise<void> {
    if (!(await lstat(this.path)).isDirectory())
      throw new Error(
        "Archive target must be a regular checkout directory, not a symlink",
      );
    const target = await realpath(this.path);
    const application = await realpath(resolve(import.meta.dirname, "../.."));
    const overlaps = (a: string, b: string) => {
      const rel = relative(a, b);
      return (
        rel === "" ||
        (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
      );
    };
    // Canonical paths catch aliases as well as nested/ancestor application targets.
    if (overlaps(application, target) || overlaps(target, application))
      throw new Error("Archive target overlaps the application checkout");
    if (this.git("rev-parse", "--is-bare-repository") !== "false")
      throw new Error("Archive target must be a non-bare checkout");
    if ((await realpath(this.git("rev-parse", "--show-toplevel"))) !== target)
      throw new Error("--archive-dir must name the checkout root");
    const branch = this.git("symbolic-ref", "--quiet", "--short", "HEAD");
    const defaults = this.git(
      "for-each-ref",
      "--format=%(symref)",
      "refs/remotes",
    )
      .split("\n")
      .filter(Boolean)
      .map((ref) => ref.split("/").slice(3).join("/"));
    defaults.push(
      "main",
      "master",
      this.git("config", "--default", "main", "--get", "init.defaultBranch"),
    );
    if (branch !== "mirror-data-v2" || defaults.includes(branch))
      throw new Error(
        "Archive checkout must be on mirror-data-v2, distinct from the default branch",
      );
    if (
      this.git("ls-files", "-v", "-z")
        .split("\0")
        .some((entry) => entry && entry[0] !== "H")
    )
      throw new Error(
        "Archive index flags can hide tracked changes; prepare a checkout without assume-unchanged or skip-worktree entries",
      );
    if (
      this.git("status", "--porcelain=v1", "--untracked-files=all", "--ignored")
    )
      throw new Error(
        "Archive checkout is dirty; preserve your work and prepare a clean dedicated checkout",
      );
  }
  async read(allowEmpty = false): Promise<DirectoryInput> {
    await this.assertSafeTarget();
    const files: ArchiveFiles = new Map();
    const walk = async (directory: string, prefix = ""): Promise<void> => {
      for (const name of await readdir(directory)) {
        if (!prefix && name === ".git") continue;
        const path = prefix + name;
        const info = await lstat(join(directory, name));
        if (info.isDirectory() && ["snapshots", "posts"].includes(path))
          await walk(join(directory, name), path + "/");
        else if (info.isFile())
          files.set(path, {
            mode: info.mode & 0o111 ? "100755" : "100644",
            bytes: await readFile(join(directory, name)),
          });
        else throw new Error(`Unsafe/nonregular archive object: ${path}`);
      }
    };
    await walk(this.path);
    const metadata = files.get("metadata.json");
    if (!metadata && (!allowEmpty || files.size))
      throw new Error(
        "No valid persisted metadata.json; Capture may initialize only an empty dedicated archive",
      );
    const input = {
      manifest: metadata ? readManifest(metadata.bytes) : emptyManifest(),
      files,
    };
    validateDirectoryArchive(input);
    return input;
  }
  async promote(
    input: DirectoryInput,
    candidate: DirectoryInput,
  ): Promise<void> {
    validateDirectoryArchive(candidate);
    const temporary = await mkdtemp(
      join(dirname(this.path), ".copilot-directory-"),
    );
    try {
      const changed = [...candidate.files].filter(
        ([path, file]) => !input.files.get(path)?.bytes.equals(file.bytes),
      );
      for (const [path, file] of changed) {
        await mkdir(dirname(join(temporary, path)), { recursive: true });
        await writeFile(join(temporary, path), file.bytes, {
          mode: file.mode === "100755" ? 0o755 : 0o644,
        });
      }
      await this.assertSafeTarget();
      // Metadata is installed last. Any failure is a failed stage, even after partial installation.
      changed.sort(
        ([a], [b]) =>
          Number(a === "metadata.json") - Number(b === "metadata.json"),
      );
      for (const [path] of changed) {
        await mkdir(dirname(join(this.path, path)), { recursive: true });
        await rename(join(temporary, path), join(this.path, path));
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
