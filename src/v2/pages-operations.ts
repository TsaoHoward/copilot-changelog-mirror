import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
  readFile,
  realpath,
  lstat,
} from "node:fs/promises";
import { join, resolve, relative, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { git, remoteHead, isolatedTarget } from "./stage-writer.js";
import { PagesEvidence, ExpiredPagesEvidence } from "./pages-evidence.js";
import type { PagesRecord } from "./pages-record.js";
import {
  sameReference,
  validatePages,
  artifactName,
  PAGES_WORKFLOW,
  DEPLOY_JOB,
  DEPLOY_STEP,
} from "./pages-record.js";
import type { RunReference } from "./stage-record.js";
const run = promisify(execFile);
export async function assertOwnedPath(path: string, inputs: string[]) {
  const resolved = resolve(path);
  try {
    if ((await lstat(resolved)).isSymbolicLink())
      throw new Error("State/output must not be a symlink");
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
  }

  let ancestor = dirname(resolved);
  const suffix: string[] = [];
  for (;;) {
    try {
      ancestor = await realpath(ancestor);
      break;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      suffix.unshift(basename(ancestor));
      const parent = dirname(ancestor);
      if (parent === ancestor) throw e;
      ancestor = parent;
    }
  }
  const target = join(ancestor, ...suffix, basename(resolved));
  for (const input of inputs) {
    const path = relative(await realpath(input), target);
    if (!path || (!path.startsWith("../") && path !== ".."))
      throw new Error(
        "State/output must be outside application and definition checkouts",
      );
  }
}
export async function verifyControl(definition: string, sha: string) {
  for (const name of [
    "pages-cli.ts",
    "pages-evidence.ts",
    "pages-operations.ts",
    "pages-record.ts",
    "stage-evidence.ts",
    "stage-record.ts",
    "stage-writer.ts",
    "stage-offline.ts",
  ]) {
    const expected = git(definition, "show", `${sha}:src/v2/${name}`);
    const actual = (
      await readFile(new URL(`./${name}`, import.meta.url), "utf8")
    ).trim();
    if (actual !== expected)
      throw new Error(
        `Executing workflow tools differ from recorded definition: ${name}`,
      );
  }
}
export function fresh(repo: string, r: PagesRecord): boolean {
  const head = remoteHead(repo, r.remote, r.archive_branch);
  if (head === r.archive_revision) return true;
  Object.assign(r, {
    outcome: "superseded",
    diagnostic: `Remote archive ${head} supersedes selected ${r.archive_revision}; start fresh publish-only`,
    url: null,
    job_id: null,
    completed_at: null,
  });
  return false;
}
export async function comparison(
  r: PagesRecord,
  evidence: PagesEvidence,
): Promise<boolean> {
  let baseline;
  try {
    baseline = await evidence.baseline();
  } catch (e) {
    if (
      !(e instanceof ExpiredPagesEvidence) ||
      r.recovery !== "reestablish" ||
      r.mode !== "manual"
    )
      throw e;
    r.baseline = e.candidate;
    r.recovery_candidate = e.candidate;
    r.recovery_reason = "baseline-evidence-expired";
    return true;
  }
  r.baseline = baseline?.baseline ?? null;
  if (r.recovery === "reestablish") {
    // A concurrent verified publication makes recovery unnecessary, but cannot turn it into a bypass.
    if (!r.recovery_reason)
      throw new Error(
        "Re-establishment requires positively established expired successful baseline evidence",
      );
    // Retain the original operator decision and expired candidate in provenance.
  }
  if (baseline?.deployment_identity === r.deployment_identity && !r.force) {
    r.outcome = "duplicate";
    r.diagnostic =
      "Identical inputs already have a verified successful deployment";
    return false;
  }
  return true;
}
export async function selectPages(options: {
  repo: string;
  definition: string;
  remote: string;
  evidence: PagesEvidence;
  ref: RunReference;
  render?: RunReference;
  mode: "manual" | "automatic";
  force: boolean;
  recovery: "none" | "reestablish";
  base: string;
  site: string | null;
  definitionFile: string;
  eventSha?: string;
}): Promise<PagesRecord> {
  const { evidence, repo, definition, ref } = options;
  isolatedTarget(evidence.archiveBranch);
  if (!/^[\w.-]+$/.test(options.remote) || options.remote.startsWith("-"))
    throw new Error("Invalid archive remote name");
  const self = await evidence.attempt(ref, PAGES_WORKFLOW, false);
  if (self.head_sha !== git(definition, "rev-parse", "HEAD"))
    throw new Error(
      "Workflow definition checkout does not match trusted execution",
    );
  if ((self.event === "workflow_run") !== (options.mode === "automatic"))
    throw new Error("Requested mode contradicts server event");
  const current = remoteHead(repo, options.remote, evidence.archiveBranch);
  if (!current)
    throw new Error("No remote archive; renew render-only evidence first");
  const rendered = options.render
    ? await evidence.handoff(options.render, "render")
    : await evidence.currentRender(current, options.remote);
  if (
    options.eventSha !== undefined &&
    options.eventSha !== rendered.definition_sha
  )
    throw new Error(
      "Completion event contradicts exact server render definition",
    );
  if (rendered.remote !== options.remote)
    throw new Error("Selected archive remote mismatch");
  if (
    !rendered.archive_output ||
    !rendered.publication_output ||
    !["changed", "no-change"].includes(rendered.outcome)
  )
    throw new Error(
      "No successful complete render output; renew render-only evidence first",
    );
  const r: PagesRecord = {
    version: 2,
    kind: "pages",
    repository: evidence.repository,
    branch: evidence.branch,
    archive_branch: evidence.archiveBranch,
    remote: rendered.remote,
    render: { run_id: rendered.run_id, attempt: rendered.attempt },
    origin: rendered.origin,
    render_record: rendered,
    archive_revision: rendered.archive_output,
    publication_identity: rendered.publication_output,
    application_sha:
      options.mode === "automatic" ? rendered.application_sha : self.head_sha,
    definition_sha: self.head_sha,
    deployment_format: 1,
    deployment_identity: null,
    preparation: ref,
    deployment: ref,
    mode: options.mode,
    force: options.force,
    recovery: options.recovery,
    recovery_reason: null,
    recovery_candidate: null,
    baseline: null,
    artifact: null,
    base: options.base,
    site: options.site,
    definition_file: options.definitionFile,
    output: null,
    outcome: "pending",
    job_id: null,
    completed_at: null,
    url: null,
    diagnostic: null,
  };
  if (options.mode === "automatic" && !rendered.eligible)
    Object.assign(r, {
      outcome: "stage-only",
      diagnostic:
        "Successful render-only attempt does not authorize automatic Pages advancement",
    });
  else if (fresh(repo, r))
    await withSources(
      repo,
      definition,
      r,
      true,
      async (source, archive, definitionFile) => {
        const identity = await siteCommand(
          source,
          archive,
          definitionFile,
          r,
          "identity",
        );
        r.deployment_identity = identity.deployment_identity;
        if (identity.publication_identity !== r.publication_identity)
          throw new Error(
            "Canonical identity contradicts exact render evidence",
          );
        await comparison(r, evidence);
      },
    );
  validatePages(r);
  return r;
}
async function exported(repo: string, sha: string, target: string) {
  // Reject links/special members before using tar. Git paths cannot escape invocation state.
  const tree = git(repo, "ls-tree", "-rz", "--full-tree", sha);
  for (const entry of tree.split("\0").filter(Boolean)) {
    const match = entry.match(/^(100644|100755) blob [a-f0-9]{40}\t(.+)$/s);
    if (
      !match ||
      match[2]!.startsWith("/") ||
      match[2]!.split("/").some((p) => !p || p === ".." || p === ".")
    )
      throw new Error("Unsafe committed source/archive tree");
  }
  await mkdir(target);
  const bytes = execFileSync("git", ["-C", repo, "archive", sha], {
    maxBuffer: 128 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", target], { input: bytes });
}
async function withSources<T>(
  repo: string,
  definition: string,
  r: PagesRecord,
  installed: boolean,
  callback: (
    source: string,
    archive: string,
    definitionFile: string,
  ) => Promise<T>,
): Promise<T> {
  if (git(definition, "rev-parse", "HEAD") !== r.definition_sha)
    throw new Error("Selected workflow definition checkout mismatch");
  git(
    repo,
    "fetch",
    "--no-tags",
    "--no-write-fetch-head",
    r.remote,
    r.archive_revision,
  );
  try {
    git(repo, "cat-file", "-e", `${r.application_sha}^{commit}`);
  } catch {
    git(
      repo,
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      r.remote,
      r.application_sha,
    );
  }
  const temporary = await mkdtemp(join(tmpdir(), "copilot-pages-"));
  try {
    const source = join(temporary, "source"),
      archive = join(temporary, "archive"),
      control = join(temporary, "control");
    await exported(repo, r.application_sha, source);
    await exported(repo, r.archive_revision, archive);
    await exported(definition, r.definition_sha, control);
    if (installed)
      await symlink(
        resolve(repo, "node_modules"),
        join(source, "node_modules"),
      );
    else {
      // Presentation owns installation flags as well as build settings.
      await symlink(
        resolve(definition, "node_modules"),
        join(source, "node_modules"),
      );
      await siteCommand(
        source,
        archive,
        join(control, r.definition_file),
        r,
        "install",
      );
    }
    return await callback(source, archive, join(control, r.definition_file));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
async function siteCommand(
  source: string,
  archive: string,
  definition: string,
  r: PagesRecord,
  command: string,
  output?: string,
) {
  const guard = join(source, ".pages-offline.ts");
  if (command !== "install")
    await writeFile(
      guard,
      await readFile(new URL("./stage-offline.ts", import.meta.url)),
    );
  const result = await run(
    process.execPath,
    [
      ...(command !== "install" ? ["--import", guard] : []),
      "--import",
      "tsx",
      join(source, "src/v2/site-cli.ts"),
      command,
      "--source",
      source,
      "--archive",
      archive,
      "--definition",
      definition,
      "--base",
      r.base,
      ...(r.site ? ["--site", r.site] : []),
      ...(output ? ["--output", output] : []),
    ],
    {
      cwd: source,
      env: {
        PATH: process.env.PATH,
        ...(process.env.COPILOT_NETWORK_LOG
          ? { COPILOT_NETWORK_LOG: process.env.COPILOT_NETWORK_LOG }
          : {}),
        ...(command === "build" ? { COPILOT_SITE_OFFLINE_GUARD: guard } : {}),
      },
      maxBuffer: 8_000_000,
    },
  );
  const value = JSON.parse(result.stdout);
  if (
    value.outcome !== "success" ||
    value.deployment_format !== 1 ||
    !/^[a-f0-9]{64}$/.test(value.deployment_identity)
  )
    throw new Error(
      "Selected presentation API failed to return a valid deployment identity",
    );
  return value;
}
export async function preparePages(
  repo: string,
  definition: string,
  r: PagesRecord,
  evidence: PagesEvidence,
  output: string,
  installed: boolean,
) {
  validatePages(r);
  if (r.outcome !== "pending")
    throw new Error("Preparation requires a fresh eligible selection");
  if (!fresh(repo, r)) return;
  // Preserve input/application files even when a caller supplies user work or an unsafe output.
  await assertOwnedPath(output, [repo, definition]);
  const target = resolve(output);
  await withSources(
    repo,
    definition,
    r,
    installed,
    async (source, archive, definitionFile) => {
      const identity = await siteCommand(
        source,
        archive,
        definitionFile,
        r,
        "identity",
      );
      if (
        identity.publication_identity !== r.publication_identity ||
        identity.deployment_identity !== r.deployment_identity
      )
        throw new Error(
          "Selected identity changed after preparation selection",
        );
      if (!(await comparison(r, evidence))) return;
      if (!fresh(repo, r)) return;
      const built = await siteCommand(
        source,
        archive,
        definitionFile,
        r,
        "build",
        target,
      );
      if (built.deployment_identity !== r.deployment_identity)
        throw new Error("Build identity disagrees with prepared identity");
      r.output = target;
      r.outcome = "built";
    },
  );
}
export async function bindPages(
  r: PagesRecord,
  evidence: PagesEvidence,
  id: number,
) {
  if (r.outcome !== "built")
    throw new Error("Artifact binding requires successful real build");
  const artifact = await evidence.artifact(
    r.preparation,
    artifactName("build", r.preparation),
  );
  if (artifact.id !== id)
    throw new Error("Uploaded Pages artifact does not match exact selected ID");
  const jobs = await evidence.jobs(r.preparation);
  evidence.job(
    jobs,
    "prepare",
    ["Build selected site", "Upload Pages artifact"],
    false,
  );
  r.artifact = { id, name: artifact.name, preparation: r.preparation };
  r.outcome = "prepared";
}
export async function authorizePages(
  repo: string,
  r: PagesRecord,
  evidence: PagesEvidence,
  ref: RunReference,
) {
  const self = await evidence.attempt(ref, PAGES_WORKFLOW, false);
  if (
    ref.run_id !== r.preparation.run_id ||
    ref.attempt < r.preparation.attempt ||
    self.head_sha !== r.definition_sha
  )
    throw new Error(
      "Retry must retain original run/definition and preparation attempt",
    );
  const original = await evidence.handoff(r.render, "render");
  if (JSON.stringify(original) !== JSON.stringify(r.render_record))
    throw new Error(
      "Render evidence changed since original preparation; renew render-only evidence",
    );
  r.deployment = ref;
  if (!fresh(repo, r) || !(await comparison(r, evidence))) return;
  // Retry verifies exact original artifact availability; no identity recomputation or rebuild.
  const artifact = await evidence.artifact(r.preparation, r.artifact!.name);
  if (artifact.id !== r.artifact!.id)
    throw new Error("Retry artifact ID mismatch");
  if (!fresh(repo, r)) return;
  r.outcome = "authorized";
}
export async function reportPages(
  r: PagesRecord,
  evidence: PagesEvidence,
  url: string,
  id: number,
) {
  if (r.outcome !== "authorized")
    throw new Error("Only authorized successful deployment can be recorded");
  const job = evidence.job(
    await evidence.jobs(r.deployment),
    DEPLOY_JOB,
    [DEPLOY_STEP],
    false,
  );
  if (job.id !== id) throw new Error("Deployment job ID mismatch");
  r.outcome = "deployed";
  r.url = url;
  r.job_id = id;
  r.completed_at = job.steps.find(
    (step: any) => step.name === DEPLOY_STEP,
  ).completed_at;
  r.diagnostic = null;
  validatePages(r);
}
