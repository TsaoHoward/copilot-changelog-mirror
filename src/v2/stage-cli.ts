import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { newRecord, invalidate, validateRecord } from "./stage-record.js";
import type { Stage, StageRecord } from "./stage-record.js";
import { git, isolatedTarget, remoteHead, writeStage } from "./stage-writer.js";
import { ActionsEvidence } from "./stage-evidence.js";
import { selectActions, selectUpstream } from "./stage-selection.js";
let record: StageRecord | undefined;
let state: string | undefined;
try {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string", default: process.cwd() },
      "definition-repo": { type: "string", default: process.cwd() },
      repository: { type: "string" },
      branch: { type: "string", default: "main" },
      "archive-branch": { type: "string" },
      remote: { type: "string", default: "origin" },
      stage: { type: "string" },
      state: { type: "string" },
      advance: { type: "string" },
      "run-id": { type: "string", default: "1" },
      attempt: { type: "string", default: "1" },
      "upstream-run": { type: "string" },
      "upstream-attempt": { type: "string" },
      "upstream-stage": { type: "string", default: "capture" },
      "feed-url": { type: "string" },
      "timeout-ms": { type: "string" },
    },
  });
  state = v.state;
  if (positionals.length !== 1)
    throw new Error("Use stage <capture|render|select|write|report|verify>");
  const command = positionals[0]!;
  const repo = resolve(v.repo!);
  const definition = resolve(v["definition-repo"]!);
  const stage = (
    command === "capture" || command === "render" ? command : v.stage
  ) as Stage;
  if (["capture", "render", "select", "verify"].includes(command)) {
    if (command !== "verify" && !["capture", "render"].includes(stage))
      throw new Error("Select an explicit capture or render stage");
    if (!v["archive-branch"])
      throw new Error(
        "--archive-branch must explicitly select mirror-data-v2 or an isolated v2 target",
      );
    isolatedTarget(v["archive-branch"]);
    if (v.advance !== undefined && !["true", "false"].includes(v.advance))
      throw new Error("--advance must be true or false");
    record = newRecord({
      stage: command === "verify" ? "render" : stage,
      repository: v.repository ?? process.env.GITHUB_REPOSITORY ?? "",
      branch: v.branch!,
      archive_branch: v["archive-branch"],
      remote: v.remote!,
      run_id: Number(v["run-id"]),
      attempt: Number(v.attempt),
      application_sha: git(repo, "rev-parse", "HEAD"),
      definition_sha: git(definition, "rev-parse", "HEAD"),
      advance: v.advance ? v.advance === "true" : stage === "capture",
    });
    validateRecord(record);
    if (command === "select") await selectActions(repo, record);
    if (
      v["upstream-run"] !== undefined ||
      v["upstream-attempt"] !== undefined
    ) {
      if (!v["upstream-run"] || !v["upstream-attempt"])
        throw new Error("Supply both exact upstream run ID and attempt");
      const evidence = new ActionsEvidence(
        record.repository,
        record.branch,
        record.archive_branch,
      );
      const ref = {
        run_id: Number(v["upstream-run"]),
        attempt: Number(v["upstream-attempt"]),
      };
      if (command === "verify") {
        if (!["capture", "render"].includes(v["upstream-stage"]!))
          throw new Error("Invalid upstream stage");
        record = await evidence.handoff(ref, v["upstream-stage"] as Stage);
      } else await selectUpstream(record, ref, evidence);
    } else if (command === "verify")
      throw new Error("Verify requires an exact upstream run and attempt");
    if (
      ["capture", "render"].includes(command) &&
      v["upstream-run"] === undefined &&
      v["upstream-attempt"] === undefined
    )
      record.archive_input = remoteHead(
        repo,
        record.remote,
        record.archive_branch,
      );
    validateRecord(record);
  } else {
    if (!state) throw new Error("--state is required");
    const loaded: unknown = JSON.parse(await readFile(state, "utf8"));
    validateRecord(loaded);
    record = loaded;
  }
  if (!record) throw new Error("Missing selection");
  if (
    record.stage === "render" &&
    (v["feed-url"] !== undefined || v["timeout-ms"] !== undefined)
  )
    throw new Error("Render rejects capture options");
  if (["capture", "render", "write"].includes(command)) {
    if (record.outcome === "pending")
      await writeStage(repo, definition, record, [
        ...(v["feed-url"] ? ["--feed-url", v["feed-url"]] : []),
        ...(v["timeout-ms"] ? ["--timeout-ms", v["timeout-ms"]] : []),
      ]);
    else if (!["stage-only", "superseded"].includes(record.outcome))
      throw new Error(
        "Writer requires a fresh selection; run a new stage to renew evidence",
      );
  } else if (command === "report") {
    if (["failure", "cancelled"].includes(process.env.STAGE_STATUS ?? ""))
      invalidate(
        record,
        "failure",
        record.diagnostic ??
          "An Actions step failed; run a fresh stage for recovery",
      );
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        [
          `### v2 ${record.stage}: ${record.outcome}`,
          `Next-stage eligible: ${record.eligible}; advancement requested: ${record.advance}.`,
          ...(
            [
              "application_sha",
              "definition_sha",
              "archive_input",
              "archive_output",
              "candidate_revision",
              "persisted_revision",
            ] as const
          ).map((key) => `${key}: ${record![key] ?? "absent"}`),
          `Origin: run ${record.origin.run_id}, attempt ${record.origin.attempt}; upstream: ${record.upstream ? `run ${record.upstream.run_id}, attempt ${record.upstream.attempt}` : "none"}.`,
          `Counts: ${JSON.stringify(record.counts)}; canonical publication: ${record.publication_outcome ?? "not claimed"} (${record.publication_output ?? "absent"}).`,
          ...(record.diagnostic ? [`Diagnostic: ${record.diagnostic}`] : []),
          "Recovery: run a fresh capture or manual render to renew evidence; see docs/v2-operations.md.",
        ].join("\n\n") + "\n",
      );
  } else if (command !== "select" && command !== "verify")
    throw new Error("Unknown stage command");
  validateRecord(record);
  if (state) {
    await mkdir(dirname(state), { recursive: true });
    await writeFile(state, JSON.stringify(record, null, 2) + "\n");
  }
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `application=${record.application_sha}\nproceed=${record.outcome === "pending"}\n`,
    );
  console.log(JSON.stringify(record));
  if (record.outcome === "failure") {
    console.error(record.diagnostic);
    process.exitCode = 1;
  }
} catch (error) {
  const diagnostic = error instanceof Error ? error.message : String(error);
  if (record) invalidate(record, "failure", diagnostic.slice(0, 10000));
  if (state && record) {
    try {
      await mkdir(dirname(state), { recursive: true });
      await writeFile(state, JSON.stringify(record, null, 2) + "\n");
    } catch (saveError) {
      console.error(saveError);
    }
  }
  console.log(
    JSON.stringify(
      record ?? {
        version: 2,
        outcome: "failure",
        eligible: false,
        archive_output: null,
        diagnostic,
      },
    ),
  );
  console.error(diagnostic);
  process.exitCode = 1;
}
