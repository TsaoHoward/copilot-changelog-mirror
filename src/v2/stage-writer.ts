import { execFileSync, execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { GitArchive } from "./archive.js";
import { invalidate, validateRecord } from "./stage-record.js";
import type { StageRecord } from "./stage-record.js";
import type { CaptureResult } from "./capture.js";
import type { RenderResult } from "./render.js";
const run = promisify(execFile);
export function git(repo: string, ...args: string[]): string {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("GIT_")) delete env[key];
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 128 * 1024 * 1024,
    })
      .toString()
      .trim();
  } catch (error) {
    const e = error as Error & { stderr?: Buffer };
    throw new Error(
      `Git ${args[0]} failed: ${e.stderr?.toString().trim() || e.message}`,
    );
  }
}
export function remoteHead(
  repo: string,
  remote: string,
  branch: string,
): string | null {
  const lines = git(
    repo,
    "ls-remote",
    "--heads",
    remote,
    `refs/heads/${branch}`,
  );
  const entries = lines.split("\n").filter(Boolean);
  if (entries.length > 1) throw new Error("Ambiguous remote archive head");
  if (!entries.length) return null;
  const [sha, ref] = entries[0]!.split(/\s+/);
  if (!sha || !/^[a-f0-9]{40}$/.test(sha) || ref !== `refs/heads/${branch}`)
    throw new Error("Malformed remote archive head");
  return sha;
}
export function isolatedTarget(branch: string): void {
  if (branch === "mirror-data")
    throw new Error(
      "Legacy production archive is permanently protected by #24 cutover; select mirror-data-v2 or an isolated v2 target",
    );
}
export async function writeStage(
  repo: string,
  definitionRepo: string,
  r: StageRecord,
  captureArgs: string[] = [],
): Promise<void> {
  validateRecord(r);
  if (r.outcome !== "pending")
    throw new Error("Writer requires a fresh pending selection");
  let temporary: string | undefined;
  const fresh = (expected: string | null): boolean => {
    const current = remoteHead(repo, r.remote, r.archive_branch);
    if (current === expected) return true;
    invalidate(
      r,
      "superseded",
      `Remote archive ${current} supersedes selected ${expected}; run a fresh stage`,
    );
    return false;
  };
  try {
    isolatedTarget(r.archive_branch);
    const cutover = async () => {
      if (r.archive_branch === "mirror-data-v2") {
        const { verifyCutover } = await import("./cutover.js");
        return await verifyCutover({
          repo,
          repository: r.repository,
          remote: r.remote,
          branch: r.branch,
        });
      }
    };
    const production = await cutover();
    if (production && !production.bootstrap_revision && r.stage !== "capture")
      throw new Error(
        "First production operation must be fresh capture, never render of imported evidence",
      );
    if (git(repo, "rev-parse", "HEAD") !== r.application_sha)
      throw new Error("Application checkout differs from selected revision");
    if (git(definitionRepo, "rev-parse", "HEAD") !== r.definition_sha)
      throw new Error(
        "Workflow tools checkout differs from definition revision",
      );
    if (
      git(
        definitionRepo,
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--",
        "src/v2",
        "package.json",
        "package-lock.json",
      )
    )
      throw new Error(
        "Workflow tools contain source changes outside the recorded definition revision; use a clean control checkout",
      );
    if (r.stage === "render" && captureArgs.length)
      throw new Error("Render rejects capture options");
    new GitArchive(repo, r.archive_branch).assertSafeTarget();
    // Null is a pinned absence, never permission to substitute a newer remote tip.
    if (!fresh(r.archive_input)) return;
    if (r.stage === "render" && !r.archive_input)
      throw new Error("No persisted v2 evidence; run capture first");
    const local = git(
      repo,
      "for-each-ref",
      "--format=%(objectname)",
      `refs/heads/${r.archive_branch}`,
    );
    if (local && local !== r.archive_input)
      throw new Error(
        "User-owned archive ref conflicts with remote input; use a fresh application checkout",
      );
    if (r.archive_input)
      git(
        repo,
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        r.remote,
        r.archive_input,
      );
    temporary = await mkdtemp(join(tmpdir(), "copilot-v2-stage-"));
    git(temporary, "init", "-q", "-b", "stage-application");
    git(
      temporary,
      "config",
      "user.name",
      git(
        repo,
        "config",
        "--default",
        "github-actions[bot]",
        "--get",
        "user.name",
      ),
    );
    git(
      temporary,
      "config",
      "user.email",
      git(
        repo,
        "config",
        "--default",
        "41898282+github-actions[bot]@users.noreply.github.com",
        "--get",
        "user.email",
      ),
    );
    if (r.archive_input)
      git(
        temporary,
        "fetch",
        "--no-tags",
        repo,
        `${r.archive_input}:refs/heads/${r.archive_branch}`,
      );
    // Execute committed application source while preserving the user's working tree.
    const application = join(temporary, "application");
    git(temporary, "init", "-q", "-b", "selected-application", application);
    git(application, "fetch", "--no-tags", repo, r.application_sha);
    git(application, "checkout", "--detach", r.application_sha);
    await symlink(
      resolve(repo, "node_modules"),
      join(application, "node_modules"),
    );
    const offlineGuard = join(application, ".stage-offline.ts");
    if (r.stage === "render")
      await writeFile(
        offlineGuard,
        git(
          definitionRepo,
          "show",
          `${r.definition_sha}:src/v2/stage-offline.ts`,
        ),
      );
    if (!fresh(r.archive_input)) return;
    const output = await run(
      process.execPath,
      [
        ...(r.stage === "render" ? ["--import", offlineGuard] : []),
        "--import",
        "tsx",
        join(application, "src/v2/cli.ts"),
        r.stage,
        "--repo",
        temporary,
        "--data-branch",
        r.archive_branch,
        ...captureArgs,
      ],
      { cwd: definitionRepo, env: { ...process.env }, maxBuffer: 2_000_000 },
    );
    const result = JSON.parse(output.stdout) as CaptureResult | RenderResult;
    if (result.outcome === "failure") throw new Error(result.diagnostic);
    if (result.archive_input !== r.archive_input)
      throw new Error("Application used a different archive input");
    if (
      git(temporary, "rev-parse", `refs/heads/${r.archive_branch}`) !==
      result.archive_output
    )
      throw new Error(
        "Application candidate revision contradicts its archive ref",
      );
    r.candidate_revision = result.archive_output;
    r.counts = result.counts;
    const beforePush = await cutover();
    if (!fresh(r.archive_input)) return;
    if (result.outcome === "changed") {
      // Push using the application's authenticated remote configuration; no user refs move.
      git(
        repo,
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        temporary,
        result.archive_output,
      );
      git(
        repo,
        "push",
        ...(beforePush && !beforePush.bootstrap_revision ? ["--atomic"] : []),
        r.remote,
        `${result.archive_output}:refs/heads/${r.archive_branch}`,
        ...(beforePush && !beforePush.bootstrap_revision
          ? [`${result.archive_output}:refs/tags/v2-initial-capture`]
          : []),
      );
    }
    if (!fresh(result.archive_output)) return;
    r.persisted_revision = result.archive_output;
    await cutover();
    Object.assign(r, result, { eligible: r.advance });
    validateRecord(r);
  } catch (error) {
    const e = error as Error & { stderr?: string };
    invalidate(
      r,
      "failure",
      (e.stderr || e.message || String(error)).slice(0, 10000),
    );
    throw error;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
