import { execFileSync, execFile } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import type { TestContext } from "node:test";
import { root } from "./support.js";

const run = promisify(execFile);
export class DirectoryFixture {
  readonly dir = mkdtempSync(join(tmpdir(), "copilot-directory-"));
  readonly archive = join(this.dir, "archive");
  readonly remote = join(this.dir, "remote.git");
  constructor(t: TestContext) {
    t.after(() => rmSync(this.dir, { recursive: true, force: true }));
    mkdirSync(this.archive);
    this.git("init", "-q", "-b", "mirror-data-v2");
    this.git("config", "user.name", "Fixture");
    this.git("config", "user.email", "fixture@example.invalid");
    this.git("commit", "--allow-empty", "-qm", "Prepared empty archive");
  }
  git(...args: string[]): string {
    return execFileSync("git", ["-C", this.archive, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
      .toString()
      .trim();
  }
  source(name: string, bytes: string | Buffer): string {
    const path = join(this.dir, name);
    writeFileSync(path, bytes);
    return pathToFileURL(path).href;
  }
  feed(items: string): string {
    return this.source("feed.xml", `<rss><channel>${items}</channel></rss>`);
  }
  manifest() {
    return JSON.parse(
      readFileSync(join(this.archive, "metadata.json"), "utf8"),
    );
  }
  persist(message: string): string {
    this.git("add", ".");
    this.git("commit", "-qm", message);
    return this.git("rev-parse", "HEAD");
  }
  async cli(
    stage: "capture" | "render",
    extra: string[] = [],
    env: NodeJS.ProcessEnv = {},
    imports: string[] = [],
  ) {
    try {
      const output = await run(
        process.execPath,
        [
          ...imports.flatMap((p) => ["--import", p]),
          "--import",
          "tsx",
          join(root, `src/v2/${stage}-directory-cli.ts`),
          "--archive-dir",
          this.archive,
          ...extra,
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            COPILOT_CAPTURE_NOW: "2026-10-01T00:00:00.000Z",
            ...env,
          },
        },
      );
      return { code: 0, ...output, result: JSON.parse(output.stdout) };
    } catch (error: any) {
      return {
        code: error.code,
        stdout: error.stdout,
        stderr: error.stderr,
        result: error.stdout ? JSON.parse(error.stdout) : null,
      };
    }
  }
}
