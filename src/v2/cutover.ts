import { mkdtemp, rm, lstat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GitArchive } from "./archive.js";
import { ActionsEvidence } from "./stage-evidence.js";
import { git, remoteHead } from "./stage-writer.js";

export const CHECKPOINT = "v1-final-before-v2";
const LEGACY_WORKFLOWS = [
  "mirror-and-publish.yml",
  "render-posts.yml",
  "publish-pages.yml",
].map((name) => `.github/workflows/${name}`);
const PRODUCTION_WORKFLOWS = ["capture", "render", "pages"].map(
  (stage) => `.github/workflows/v2-${stage}.yml`,
);

export interface CutoverOptions {
  repo: string;
  repository: string;
  remote: string;
  branch: string;
  legacyRevision?: string;
}

async function inventory(
  evidence: ActionsEvidence,
  path: string,
  key: string,
): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; ; page++) {
    const response = await evidence.request(
      `${path}?per_page=100&page=${page}`,
    );
    if (!Array.isArray(response[key]))
      throw new Error("Malformed Actions inventory");
    items.push(...response[key]);
    if (response[key].length < 100) return items;
  }
}

/** Quiescence is checked against the server, including downstream waiting jobs. */
async function quiescence(
  options: CutoverOptions,
  checkpoint: boolean,
): Promise<void> {
  const { repo, remote, repository, branch } = options;
  const evidence = new ActionsEvidence(repository, branch, "mirror-data-v2");
  const workflows = await inventory(
    evidence,
    "/actions/workflows",
    "workflows",
  );
  const source = remoteHead(repo, remote, branch);
  if (!source) throw new Error("Default application branch is unavailable");
  git(repo, "fetch", "--no-tags", "--no-write-fetch-head", remote, source);
  for (const path of LEGACY_WORKFLOWS) {
    const workflow = workflows.find((w) => w.path === path);
    const removed = !git(repo, "ls-tree", source, "--", path);
    if (
      (!checkpoint && removed) ||
      ["disabled_manually", "disabled_inactivity", "deleted"].includes(
        workflow?.state,
      )
    )
      continue;
    throw new Error(`Legacy quiescence requires a disabled workflow: ${path}`);
  }
  if (checkpoint)
    for (const path of PRODUCTION_WORKFLOWS) {
      if (!git(repo, "ls-tree", source, "--", path)) continue;
      const definition = git(repo, "show", `${source}:${path}`);
      if (
        /ARCHIVE_BRANCH: mirror-data-v2(?:\s|$)/.test(definition) &&
        !["disabled_manually", "disabled_inactivity", "deleted"].includes(
          workflows.find((w) => w.path === path)?.state,
        )
      )
        throw new Error(
          `Checkpoint requires exclusive quiescence; disable production workflow ${path}`,
        );
    }
  const runs = await inventory(evidence, "/actions/runs", "workflow_runs");
  for (const run of runs)
    if (
      [
        ...LEGACY_WORKFLOWS,
        ...(checkpoint ? PRODUCTION_WORKFLOWS : []),
      ].includes(run.path?.split("@")[0]) &&
      run.status !== "completed"
    )
      throw new Error(
        `Outstanding legacy consumer run ${run.id}: ${run.status}`,
      );
}

function checkpointHead(repo: string, remote: string): string | null {
  const value = git(
    repo,
    "ls-remote",
    "--tags",
    remote,
    `refs/tags/${CHECKPOINT}`,
  );
  if (!value) return null;
  const parts = value.split(/\s+/);
  if (
    parts.length !== 2 ||
    !/^[a-f0-9]{40}$/.test(parts[0]!) ||
    parts[1] !== `refs/tags/${CHECKPOINT}`
  )
    throw new Error("Malformed checkpoint resolution");
  return parts[0]!;
}

async function restored(repo: string, remote: string, revision: string) {
  const directory = await mkdtemp(join(tmpdir(), "copilot-v1-checkpoint-"));
  try {
    git(directory, "init", "-q");
    git(
      directory,
      "fetch",
      "--no-tags",
      git(repo, "remote", "get-url", remote),
      revision,
    );
    git(directory, "checkout", "--detach", revision);
    git(directory, "fsck", "--strict", "--no-reflogs", revision);
    const tree = git(directory, "ls-tree", "-rz", revision);
    const files = [];
    for (const line of tree.split("\0").filter(Boolean)) {
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(line);
      if (!match)
        throw new Error("Checkpoint contains nonregular archive objects");
      const [, mode, oid, path] = match;
      const file = join(directory, path!);
      const stat = await lstat(file);
      if (
        !stat.isFile() ||
        git(directory, "hash-object", "--no-filters", file) !== oid ||
        ((stat.mode & 0o111) !== 0) !== (mode === "100755")
      )
        throw new Error(
          `Checkpoint restoration differs from original blob: ${path}`,
        );
      files.push({ path: path!, mode: mode!, blob: oid! });
    }
    for (const pattern of [
      /^snapshots\/.+\.html$/,
      /^snapshots\/.+\.json$/,
      /^posts\/.+\.md$/,
    ])
      if (!files.some((f) => pattern.test(f.path)))
        throw new Error(
          "Checkpoint lacks original v1 HTML, sidecars or Markdown",
        );
    for (const f of files.filter((f) => /^posts\/.+\.md$/.test(f.path)))
      if (!git(directory, "show", `${revision}:${f.path}`).startsWith("---\n"))
        throw new Error(`Checkpoint lacks original front matter: ${f.path}`);
    return {
      tree: git(directory, "rev-parse", `${revision}^{tree}`),
      history_count: Number(git(directory, "rev-list", "--count", revision)),
      restored_files: files,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function freshTarget(options: CutoverOptions): Promise<string | null> {
  const { repo, remote } = options;
  const revision = remoteHead(repo, remote, "mirror-data-v2");
  if (!revision) return null;
  git(repo, "fetch", "--no-tags", "--no-write-fetch-head", remote, revision);
  if (git(repo, "ls-tree", "-r", revision))
    throw new Error(
      "Fresh production target must be absent or genuinely empty; refuse unexplained nonempty state",
    );
  return revision;
}

export async function checkpointV1(options: CutoverOptions) {
  const { repo, remote, legacyRevision } = options;
  if (!legacyRevision || !/^[a-f0-9]{40}$/.test(legacyRevision))
    throw new Error(
      "Select the final exact --legacy-revision after disabling and draining legacy workflows",
    );
  await quiescence(options, true);
  if (remoteHead(repo, remote, "mirror-data") !== legacyRevision)
    throw new Error(
      "Legacy revision moved; stop and reselect the final quiescent revision",
    );
  const existing = checkpointHead(repo, remote);
  if (existing && existing !== legacyRevision)
    throw new Error(
      "Conflicting checkpoint ref; never replace preserved history",
    );
  const initial = await freshTarget(options);
  const proof = await restored(repo, remote, legacyRevision);
  await quiescence(options, true);
  if (
    remoteHead(repo, remote, "mirror-data") !== legacyRevision ||
    (await freshTarget(options)) !== initial
  )
    throw new Error("Competing archive state during checkpoint verification");
  if (!existing) {
    git(
      repo,
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      remote,
      legacyRevision,
    );
    git(repo, "push", remote, `${legacyRevision}:refs/tags/${CHECKPOINT}`);
  }
  if (
    checkpointHead(repo, remote) !== legacyRevision ||
    remoteHead(repo, remote, "mirror-data") !== legacyRevision ||
    (await freshTarget(options)) !== initial
  )
    throw new Error(
      "Checkpoint remote verification failed or a late legacy/target write occurred",
    );
  return {
    version: 1,
    outcome: "checkpointed",
    repository: options.repository,
    default_branch: options.branch,
    remote,
    checkpoint: CHECKPOINT,
    legacy_revision: legacyRevision,
    archive_branch: "mirror-data-v2",
    initial_archive_revision: initial,
    ...proof,
    verified_at: new Date().toISOString(),
  };
}

/** Every production writer checks the immutable legacy boundary before mutation. */
export async function verifyCutover(options: CutoverOptions) {
  const { repo, remote } = options;
  const checkpoint = checkpointHead(repo, remote);
  if (!checkpoint)
    throw new Error(
      `Missing verified v1 checkpoint refs/tags/${CHECKPOINT}; production bootstrap is blocked`,
    );
  const legacy = remoteHead(repo, remote, "mirror-data");
  if (
    legacy !== checkpoint ||
    (options.legacyRevision && legacy !== options.legacyRevision)
  )
    throw new Error(
      "Legacy revision differs from checkpoint; investigate late legacy writes before activation",
    );
  await quiescence(options, false);
  await restored(repo, remote, checkpoint);
  // Re-read after API/Git inventory rather than treating a previous observation as a lease.
  if (
    checkpointHead(repo, remote) !== checkpoint ||
    remoteHead(repo, remote, "mirror-data") !== legacy
  )
    throw new Error(
      "Checkpoint or legacy archive changed during quiescence verification",
    );
  new GitArchive(repo, "mirror-data-v2").assertSafeTarget();
  return {
    version: 1,
    outcome: "verified",
    checkpoint: CHECKPOINT,
    legacy_revision: legacy,
    archive_branch: "mirror-data-v2",
    verified_at: new Date().toISOString(),
  };
}
