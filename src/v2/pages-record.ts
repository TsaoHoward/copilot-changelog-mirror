import { reference, SHA, validateRecord } from "./stage-record.js";
import type { RunReference, StageRecord } from "./stage-record.js";
export const PAGES_WORKFLOW = "v2-pages.yml";
export const EVIDENCE_DAYS = 90;
export const PREPARE_JOB = "prepare";
export const DEPLOY_JOB = "deploy";
export const DEPLOY_STEP = "Deploy Pages";
export const RESULT_STEPS = [
  DEPLOY_STEP,
  "Record deployment",
  "Publish deployment evidence",
  "Report evidence publication outcome",
];
export interface BaselineReference {
  deployment: RunReference;
  job_id: number;
  completed_at: string;
}
export interface PagesRecord {
  version: 2;
  kind: "pages";
  repository: string;
  branch: string;
  archive_branch: string;
  remote: string;
  render: RunReference;
  origin: RunReference;
  render_record: StageRecord;
  archive_revision: string;
  publication_identity: string;
  application_sha: string;
  definition_sha: string;
  deployment_format: 1;
  deployment_identity: string | null;
  preparation: RunReference;
  deployment: RunReference;
  mode: "manual" | "automatic";
  force: boolean;
  recovery: "none" | "reestablish";
  recovery_reason: string | null;
  recovery_candidate: BaselineReference | null;
  baseline: BaselineReference | null;
  artifact: { id: number; name: string; preparation: RunReference } | null;
  base: string;
  site: string | null;
  definition_file: string;
  output: string | null;
  outcome:
    | "pending"
    | "built"
    | "prepared"
    | "authorized"
    | "deployed"
    | "duplicate"
    | "stage-only"
    | "superseded"
    | "failure";
  job_id: number | null;
  completed_at: string | null;
  url: string | null;
  diagnostic: string | null;
}
export function sameReference(a: RunReference, b: RunReference) {
  return a.run_id === b.run_id && a.attempt === b.attempt;
}
export function artifactName(
  kind: "build" | "preparation" | "result",
  ref: RunReference,
) {
  return `v2-pages-${kind}-${ref.run_id}-${ref.attempt}`;
}
export function validatePages(value: unknown): asserts value is PagesRecord {
  const r = value as PagesRecord;
  const fail = (field: string): never => {
    throw new Error(`Invalid v2 Pages evidence: ${field}`);
  };
  if (!r || r.version !== 2 || r.kind !== "pages") fail("schema/version");
  validateRecord(r.render_record);
  const render = r.render_record;
  if (
    render.stage !== "render" ||
    !["changed", "no-change"].includes(render.outcome)
  )
    fail("successful render");
  for (const k of ["repository", "branch", "archive_branch", "remote"] as const)
    if (r[k] !== render[k]) fail(k);
  for (const ref of [r.render, r.origin, r.preparation, r.deployment])
    if (!reference(ref)) fail("reference");
  if (
    !sameReference(r.render, {
      run_id: render.run_id,
      attempt: render.attempt,
    }) ||
    !sameReference(r.origin, render.origin)
  )
    fail("render/origin");
  if (
    r.archive_revision !== render.archive_output ||
    r.publication_identity !== render.publication_output
  )
    fail("render output identity");
  for (const k of [
    "application_sha",
    "definition_sha",
    "archive_revision",
  ] as const)
    if (!SHA.test(r[k])) fail(k);
  if (r.mode !== "manual" && r.mode !== "automatic") fail("mode");
  if (r.mode === "automatic" && r.application_sha !== render.application_sha)
    fail("inherited application");
  if (
    typeof r.force !== "boolean" ||
    !["none", "reestablish"].includes(r.recovery)
  )
    fail("force/recovery");
  if (r.recovery === "reestablish" && r.mode !== "manual")
    fail("manual recovery");
  if (
    r.recovery_reason !== null &&
    (r.recovery !== "reestablish" ||
      !r.recovery_candidate ||
      r.recovery_reason !== "baseline-evidence-expired")
  )
    fail("recovery provenance");
  if (
    r.deployment_format !== 1 ||
    (r.deployment_identity !== null &&
      !/^[a-f0-9]{64}$/.test(r.deployment_identity))
  )
    fail("deployment identity");
  if (
    ![
      "pending",
      "built",
      "prepared",
      "authorized",
      "deployed",
      "duplicate",
      "stage-only",
      "superseded",
      "failure",
    ].includes(r.outcome)
  )
    fail("outcome");
  if (
    ["built", "prepared", "authorized", "deployed", "duplicate"].includes(
      r.outcome,
    ) &&
    !r.deployment_identity
  )
    fail("missing identity");
  if ((r.recovery_reason === null) !== (r.recovery_candidate === null))
    fail("recovery candidate");
  for (const baseline of [r.baseline, r.recovery_candidate])
    if (
      baseline !== null &&
      (!reference(baseline.deployment) ||
        !Number.isSafeInteger(baseline.job_id) ||
        baseline.job_id < 1 ||
        !Number.isFinite(Date.parse(baseline.completed_at)))
    )
      fail("baseline");
  if (
    r.artifact !== null &&
    (!Number.isSafeInteger(r.artifact.id) ||
      r.artifact.id < 1 ||
      !reference(r.artifact.preparation) ||
      !sameReference(r.artifact.preparation, r.preparation) ||
      r.artifact.name !== artifactName("build", r.preparation))
  )
    fail("artifact");
  if (["prepared", "authorized", "deployed"].includes(r.outcome) && !r.artifact)
    fail("missing artifact");
  if (
    r.preparation.run_id !== r.deployment.run_id ||
    r.preparation.attempt > r.deployment.attempt
  )
    fail("retry relationship");
  if (r.outcome === "deployed") {
    if (
      !Number.isSafeInteger(r.job_id) ||
      r.job_id! < 1 ||
      !r.url ||
      !r.completed_at ||
      !Number.isFinite(Date.parse(r.completed_at))
    )
      fail("deployment job/URL/completion");
    const url = new URL(r.url!);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      fail("deployment URL");
  } else if (r.url !== null || r.job_id !== null || r.completed_at !== null)
    fail("false deployment claim");
  for (const k of ["diagnostic", "recovery_reason", "output", "site"] as const)
    if (r[k] !== null && (typeof r[k] !== "string" || r[k]!.length > 10000))
      fail(k);
  if (
    ["failure", "superseded", "stage-only"].includes(r.outcome) &&
    !r.diagnostic
  )
    fail("diagnostic");
  if (
    typeof r.base !== "string" ||
    typeof r.definition_file !== "string" ||
    !/^[\w./-]+$/.test(r.definition_file) ||
    r.definition_file.startsWith("/") ||
    r.definition_file.split("/").includes("..")
  )
    fail("build selections");
}
export function failPages(r: PagesRecord, diagnostic: string) {
  Object.assign(r, {
    outcome: "failure",
    diagnostic: diagnostic.slice(0, 10000),
    url: null,
    job_id: null,
    completed_at: null,
  });
}
