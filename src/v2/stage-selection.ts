import { readFile } from "node:fs/promises";
import { ActionsEvidence } from "./stage-evidence.js";
import { git, remoteHead } from "./stage-writer.js";
import type { StageRecord, RunReference } from "./stage-record.js";
export async function selectUpstream(
  r: StageRecord,
  ref: RunReference,
  evidence: ActionsEvidence,
  eventSha?: string,
): Promise<void> {
  if (r.stage !== "render")
    throw new Error("Only render consumes capture evidence");
  const upstream = await evidence.handoff(ref, "capture");
  if (eventSha !== undefined && upstream.definition_sha !== eventSha)
    throw new Error("Completion event contradicts server definition revision");
  if (upstream.remote !== r.remote)
    throw new Error("Handoff archive remote mismatch");
  Object.assign(r, {
    upstream: ref,
    origin: upstream.origin,
    application_sha: upstream.application_sha,
    archive_input: upstream.archive_output,
    advance: true,
  });
  if (!upstream.eligible)
    Object.assign(r, {
      outcome: "stage-only",
      advance: false,
      eligible: false,
      diagnostic: `Capture ${upstream.outcome} does not authorize automatic rendering`,
    });
}
export async function selectActions(
  repo: string,
  r: StageRecord,
): Promise<void> {
  const env = process.env;
  if (!env.GITHUB_EVENT_PATH) throw new Error("Missing Actions event path");
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  if (
    event.repository?.full_name !== env.GITHUB_REPOSITORY ||
    r.repository !== env.GITHUB_REPOSITORY ||
    event.repository?.default_branch !== r.branch ||
    env.GITHUB_REF !== `refs/heads/${r.branch}` ||
    git(repo, "rev-parse", "HEAD") !== env.GITHUB_SHA
  )
    throw new Error(
      "Actions selection requires trusted repository/default branch/definition checkout",
    );
  r.run_id = Number(env.GITHUB_RUN_ID);
  r.attempt = Number(env.GITHUB_RUN_ATTEMPT);
  r.origin = { run_id: r.run_id, attempt: r.attempt };
  r.application_sha = env.GITHUB_SHA!;
  r.definition_sha = env.GITHUB_SHA!;
  if (event.inputs?.advance !== undefined) {
    if (![true, false, "true", "false"].includes(event.inputs.advance))
      throw new Error("Invalid advancement input");
    r.advance =
      event.inputs.advance === true || event.inputs.advance === "true";
  }
  if (env.GITHUB_EVENT_NAME === "workflow_run") {
    if (r.stage !== "render")
      throw new Error("Capture cannot use a completion event");
    await selectUpstream(
      r,
      {
        run_id: event.workflow_run?.id,
        attempt: event.workflow_run?.run_attempt,
      },
      new ActionsEvidence(r.repository, r.branch, r.archive_branch),
      event.workflow_run?.head_sha,
    );
  } else if (
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" &&
    !(r.stage === "capture" && env.GITHUB_EVENT_NAME === "schedule")
  )
    throw new Error("Unsupported writer event");
  if (env.GITHUB_EVENT_NAME !== "workflow_run")
    r.archive_input = remoteHead(repo, r.remote, r.archive_branch);
}
