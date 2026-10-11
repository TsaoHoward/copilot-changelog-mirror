export type Stage = "capture" | "render";
export interface RunReference {
  run_id: number;
  attempt: number;
}
export interface StageRecord {
  version: 2;
  stage: Stage;
  repository: string;
  branch: string;
  archive_branch: string;
  remote: string;
  run_id: number;
  attempt: number;
  origin: RunReference;
  upstream: RunReference | null;
  application_sha: string;
  definition_sha: string;
  archive_input: string | null;
  archive_output: string | null;
  candidate_revision: string | null;
  persisted_revision: string | null;
  outcome:
    | "pending"
    | "changed"
    | "no-change"
    | "failure"
    | "superseded"
    | "stage-only";
  counts: Record<string, number> | null;
  advance: boolean;
  eligible: boolean;
  publication_input: string | null;
  publication_output: string | null;
  publication_outcome: "initialized" | "changed" | "no-change" | null;
  diagnostic: string | null;
}
export const WORKFLOWS: Record<Stage, string> = {
  capture: "v2-capture.yml",
  render: "v2-render.yml",
};
export const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
export function reference(value: unknown): value is RunReference {
  if (!value || typeof value !== "object") return false;
  const r = value as RunReference;
  return (
    Object.keys(r).length === 2 &&
    Number.isSafeInteger(r.run_id) &&
    r.run_id > 0 &&
    Number.isSafeInteger(r.attempt) &&
    r.attempt > 0
  );
}
export function newRecord(
  input: Pick<
    StageRecord,
    | "stage"
    | "repository"
    | "branch"
    | "archive_branch"
    | "remote"
    | "run_id"
    | "attempt"
    | "application_sha"
    | "definition_sha"
    | "advance"
  >,
): StageRecord {
  return {
    ...input,
    version: 2,
    origin: { run_id: input.run_id, attempt: input.attempt },
    upstream: null,
    archive_input: null,
    archive_output: null,
    candidate_revision: null,
    persisted_revision: null,
    outcome: "pending",
    counts: null,
    eligible: false,
    publication_input: null,
    publication_output: null,
    publication_outcome: null,
    diagnostic: null,
  };
}
export function invalidate(
  r: StageRecord,
  outcome: "failure" | "superseded",
  diagnostic: string,
): void {
  Object.assign(r, {
    outcome,
    diagnostic,
    eligible: false,
    archive_output: null,
    publication_input: null,
    publication_output: null,
    publication_outcome: null,
  });
}
export function validateRecord(value: unknown): asserts value is StageRecord {
  const r = value as StageRecord;
  const fail = (field: string): never => {
    throw new Error(`Invalid v2 stage-result ${field}`);
  };
  if (!r || typeof r !== "object" || r.version !== 2) fail("schema/version");
  if (!["capture", "render"].includes(r.stage)) fail("stage");
  if (
    typeof r.repository !== "string" ||
    !/^[\w.-]+\/[\w.-]+$/.test(r.repository)
  )
    fail("repository");
  for (const k of ["branch", "archive_branch", "remote"] as const)
    if (
      typeof r[k] !== "string" ||
      !/^[\w./-]+$/.test(r[k]) ||
      r[k].startsWith("-") ||
      r[k].includes("..")
    )
      fail(k);
  if (r.archive_branch === r.branch) fail("archive branch");
  if (
    !reference({ run_id: r.run_id, attempt: r.attempt }) ||
    !reference(r.origin) ||
    (r.upstream !== null && !reference(r.upstream))
  )
    fail("run reference");
  for (const k of ["application_sha", "definition_sha"] as const)
    if (typeof r[k] !== "string" || !SHA.test(r[k])) fail(k);
  for (const k of [
    "archive_input",
    "archive_output",
    "candidate_revision",
    "persisted_revision",
  ] as const)
    if (r[k] !== null && (typeof r[k] !== "string" || !SHA.test(r[k]))) fail(k);
  for (const k of ["advance", "eligible"] as const)
    if (typeof r[k] !== "boolean") fail(k);
  if (
    ![
      "pending",
      "changed",
      "no-change",
      "failure",
      "superseded",
      "stage-only",
    ].includes(r.outcome)
  )
    fail("outcome");
  if (
    r.diagnostic !== null &&
    (typeof r.diagnostic !== "string" || r.diagnostic.length > 10000)
  )
    fail("diagnostic");
  if (
    r.counts !== null &&
    (typeof r.counts !== "object" ||
      Array.isArray(r.counts) ||
      Object.values(r.counts).some((n) => !Number.isSafeInteger(n) || n < 0))
  )
    fail("counts");
  if (
    r.outcome === "stage-only" &&
    (r.advance || r.candidate_revision || r.persisted_revision || r.counts)
  )
    fail("stage-only contradiction");
  const success = ["changed", "no-change"].includes(r.outcome);
  if (success) {
    if (
      !r.archive_output ||
      r.persisted_revision !== r.archive_output ||
      r.candidate_revision !== r.archive_output
    )
      fail("unverified output");
    if ((r.outcome === "changed") !== (r.archive_input !== r.archive_output))
      fail("archive outcome contradiction");
    if (r.eligible !== r.advance) fail("eligibility contradiction");
    const keys =
      r.stage === "capture"
        ? ["created", "updated", "unchanged"]
        : ["rendered", "updated", "unchanged"];
    if (!r.counts || Object.keys(r.counts).sort().join() !== keys.sort().join())
      fail("counts");
    if (
      r.stage === "render" &&
      (!r.archive_input ||
        !r.counts ||
        r.counts.rendered !== r.counts.updated! + r.counts.unchanged!)
    )
      fail("render counts/input");
  } else if (r.eligible || r.archive_output !== null)
    fail("unsuccessful output/eligibility");
  if (success && r.stage === "render") {
    if (
      typeof r.publication_output !== "string" ||
      !HASH.test(r.publication_output) ||
      (r.publication_input !== null &&
        (typeof r.publication_input !== "string" ||
          !HASH.test(r.publication_input)))
    )
      fail("publication identity");
    const expected =
      r.publication_input === null
        ? "initialized"
        : r.publication_input === r.publication_output
          ? "no-change"
          : "changed";
    if (
      r.publication_outcome !== expected ||
      (r.outcome === "no-change" && expected !== "no-change")
    )
      fail("publication outcome contradiction");
  } else if (
    r.publication_input !== null ||
    r.publication_output !== null ||
    r.publication_outcome !== null
  )
    fail("unexpected publication claim");
  if (r.stage === "capture" && r.upstream !== null) fail("capture upstream");
  if (
    r.upstream === null &&
    (r.origin.run_id !== r.run_id || r.origin.attempt !== r.attempt)
  )
    fail("origin contradiction");
  if (
    r.upstream !== null &&
    (r.stage !== "render" ||
      r.origin.run_id !== r.upstream.run_id ||
      r.origin.attempt !== r.upstream.attempt)
  )
    fail("upstream/origin contradiction");
  if (
    ["failure", "superseded", "stage-only"].includes(r.outcome) &&
    !r.diagnostic
  )
    fail("missing diagnostic");
}
