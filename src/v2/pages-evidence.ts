import { ActionsEvidence, unzipRecord } from "./stage-evidence.js";
import type { ActionsRun } from "./stage-evidence.js";
import { reference, SHA } from "./stage-record.js";
import type { RunReference, StageRecord } from "./stage-record.js";
import {
  artifactName,
  validatePages,
  sameReference,
  PAGES_WORKFLOW,
  PREPARE_JOB,
  DEPLOY_JOB,
  DEPLOY_STEP,
  RESULT_STEPS,
} from "./pages-record.js";
import type { PagesRecord, BaselineReference } from "./pages-record.js";
export class ExpiredPagesEvidence extends Error {
  constructor(readonly candidate: BaselineReference) {
    super(
      "baseline-evidence-unavailable: successful deployment result evidence expired; explicitly reestablish the baseline with current verified render evidence",
    );
  }
}
export class PagesEvidence extends ActionsEvidence {
  async attempt(
    ref: RunReference,
    workflow: string,
    completed = true,
  ): Promise<ActionsRun> {
    if (!reference(ref)) throw new Error("Supply a positive exact run/attempt");
    const run = (await this.request(
      `/actions/runs/${ref.run_id}/attempts/${ref.attempt}`,
    )) as ActionsRun;
    if (
      run.id !== ref.run_id ||
      run.run_attempt !== ref.attempt ||
      run.repository?.full_name !== this.repository ||
      run.head_repository?.full_name !== this.repository ||
      run.head_branch !== this.branch ||
      run.path?.split("@")[0] !== `.github/workflows/${workflow}` ||
      !["workflow_dispatch", "workflow_run"].includes(run.event) ||
      !SHA.test(run.head_sha) ||
      (completed &&
        (run.status !== "completed" || run.conclusion !== "success")) ||
      (!completed &&
        !["in_progress", "queued", "completed"].includes(run.status))
    )
      throw new Error(
        "Untrusted exact Pages workflow attempt/repository/branch/event/status",
      );
    return run;
  }
  async list(path: string, key: string): Promise<any[]> {
    const result: any[] = [];
    for (let page = 1; page <= 1000; page++) {
      const data = await this.request(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      if (!Array.isArray(data[key]))
        throw new Error(`Malformed ${key} listing`);
      result.push(...data[key]);
      if (data[key].length < 100) return result;
    }
    throw new Error(
      "Actions history pagination limit exceeded; ordering uncertain",
    );
  }
  async history(workflow: string): Promise<ActionsRun[]> {
    const runs = await this.list(
      `/actions/workflows/${workflow}/runs`,
      "workflow_runs",
    );
    const result: ActionsRun[] = [];
    const seen = new Set<number>();
    for (const run of runs) {
      if (
        !Number.isSafeInteger(run.id) ||
        run.id < 1 ||
        !Number.isSafeInteger(run.run_attempt) ||
        run.run_attempt < 1 ||
        run.run_attempt > 1000 ||
        seen.has(run.id)
      )
        throw new Error("Malformed/ambiguous run history");
      seen.add(run.id);
      if (
        run.head_branch !== this.branch ||
        run.repository?.full_name !== this.repository ||
        run.head_repository?.full_name !== this.repository ||
        run.path?.split("@")[0] !== `.github/workflows/${workflow}`
      )
        continue;
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
        const ref = { run_id: run.id, attempt };
        const exact = await this.attempt(ref, workflow, false);
        result.push(exact);
      }
    }
    return result;
  }
  async jobs(ref: RunReference): Promise<any[]> {
    const jobs = await this.list(
      `/actions/runs/${ref.run_id}/attempts/${ref.attempt}/jobs`,
      "jobs",
    );
    const ids = new Set<number>();
    for (const job of jobs) {
      if (
        !Number.isSafeInteger(job.id) ||
        job.id < 1 ||
        ids.has(job.id) ||
        job.run_id !== ref.run_id ||
        (job.run_attempt !== undefined && job.run_attempt !== ref.attempt) ||
        typeof job.name !== "string" ||
        !Array.isArray(job.steps)
      )
        throw new Error("Contradictory exact attempt jobs");
      ids.add(job.id);
    }
    return jobs;
  }
  job(jobs: any[], name: string, steps: string[], completed = true) {
    const matches = jobs.filter((j) => j.name === name);
    if (matches.length !== 1) throw new Error(`Missing/ambiguous ${name} job`);
    const job = matches[0];
    if (
      completed &&
      (job.status !== "completed" || job.conclusion !== "success")
    )
      throw new Error(`Unsuccessful ${name} job`);
    for (const name of steps) {
      const found = job.steps.filter((s: any) => s.name === name);
      if (
        found.length !== 1 ||
        found[0].status !== "completed" ||
        found[0].conclusion !== "success"
      )
        throw new Error(`Missing/unsuccessful/ambiguous ${name} step`);
    }
    return job;
  }
  async artifact(
    ref: RunReference,
    name: string,
    required = true,
  ): Promise<any> {
    const run = await this.attempt(ref, PAGES_WORKFLOW, false);
    const matches = (
      await this.list(`/actions/runs/${ref.run_id}/artifacts`, "artifacts")
    ).filter((a) => a.name === name);
    if (matches.length !== 1)
      throw new Error(
        `Missing/ambiguous exact artifact ${name}; fresh publish-only rebuild for retry, investigate missing baseline evidence`,
      );
    const a = matches[0];
    if (
      !Number.isSafeInteger(a.id) ||
      a.id < 1 ||
      a.workflow_run?.id !== ref.run_id ||
      a.workflow_run?.head_sha !== run.head_sha ||
      a.workflow_run?.head_branch !== this.branch ||
      typeof a.expired !== "boolean"
    )
      throw new Error("Artifact ownership/revision mismatch");
    if (required && a.expired)
      throw new Error(
        "Expired Pages preparation/build artifact; run fresh publish-only rebuild",
      );
    return a;
  }
  async record(
    ref: RunReference,
    kind: "preparation" | "result",
  ): Promise<PagesRecord> {
    const artifact = await this.artifact(ref, artifactName(kind, ref));
    const value = unzipRecord(
      await this.request(`/actions/artifacts/${artifact.id}/zip`, true),
      "pages.json",
    );
    validatePages(value);
    const run = await this.attempt(ref, PAGES_WORKFLOW, false);
    if (
      value.repository !== this.repository ||
      value.branch !== this.branch ||
      value.archive_branch !== this.archiveBranch ||
      value.definition_sha !== run.head_sha ||
      !sameReference(
        kind === "preparation" ? value.preparation : value.deployment,
        ref,
      )
    )
      throw new Error("Pages record ownership/definition/attempt mismatch");
    if (
      run.event === "workflow_dispatch" &&
      value.application_sha !== run.head_sha
    )
      throw new Error("Manual application contradicts trusted run");
    if ((run.event === "workflow_run") !== (value.mode === "automatic"))
      throw new Error("Publication mode contradicts trusted event");
    return value;
  }
  async preparation(ref: RunReference): Promise<PagesRecord> {
    const r = await this.record(ref, "preparation");
    if (r.outcome !== "prepared" || !sameReference(r.preparation, r.deployment))
      throw new Error("No successful original preparation");
    this.job(await this.jobs(ref), PREPARE_JOB, [
      "Build selected site",
      "Upload Pages artifact",
      "Record preparation",
      "Publish preparation evidence",
    ]);
    const artifact = await this.artifact(ref, r.artifact!.name);
    if (artifact.id !== r.artifact!.id)
      throw new Error("Exact Pages artifact ID changed");
    return r;
  }
  async baseline(): Promise<PagesRecord | null> {
    const candidates: {
      ref: RunReference;
      run: ActionsRun;
      job: any;
      jobs: any[];
      step: any;
    }[] = [];
    for (const run of await this.history(PAGES_WORKFLOW)) {
      if (run.status !== "completed" || run.conclusion !== "success") continue;
      const ref = { run_id: run.id, attempt: run.run_attempt };
      const jobs = await this.jobs(ref);
      const deploys = jobs.filter((j) => j.name === DEPLOY_JOB);
      if (deploys.length > 1) throw new Error("Ambiguous newer deployment job");
      const job = deploys[0];
      if (!job || job.conclusion === "skipped") continue;
      const steps = job.steps.filter((s: any) => s.name === DEPLOY_STEP);
      if (steps.length > 1) throw new Error("Ambiguous deployment steps");
      const step = steps[0];
      if (!step || step.conclusion === "skipped") continue;
      if (
        job.status !== "completed" ||
        job.conclusion !== "success" ||
        step.status !== "completed" ||
        step.conclusion !== "success"
      )
        continue;
      if (!Number.isFinite(Date.parse(step.completed_at)))
        throw new Error("Deployment completion ordering uncertain");
      candidates.push({ ref, run, job, jobs, step });
    }
    candidates.sort(
      (a, b) =>
        Date.parse(b.step.completed_at) - Date.parse(a.step.completed_at),
    );
    if (!candidates.length) return null;
    if (
      candidates[1] &&
      candidates[0]!.step.completed_at === candidates[1].step.completed_at
    )
      throw new Error("Ambiguous latest deployment ordering");
    const c = candidates[0]!;
    this.job([c.job], DEPLOY_JOB, RESULT_STEPS);
    const preparationSteps = [
      "Build selected site",
      "Upload Pages artifact",
      "Record preparation",
      "Publish preparation evidence",
    ];
    if (c.jobs.some((job) => job.name === PREPARE_JOB))
      this.job(c.jobs, PREPARE_JOB, preparationSteps);
    const candidate = {
      deployment: c.ref,
      job_id: c.job.id,
      completed_at: c.step.completed_at,
    };
    let resultArtifact;
    try {
      resultArtifact = await this.artifact(
        c.ref,
        artifactName("result", c.ref),
        false,
      );
    } catch (e) {
      throw new Error(
        `baseline-evidence-unavailable: ${e instanceof Error ? e.message : String(e)}; investigate unexpected absence or API failure, do not reestablish`,
      );
    }
    if (resultArtifact.expired) throw new ExpiredPagesEvidence(candidate);
    const r = await this.record(c.ref, "result");
    if (
      r.outcome !== "deployed" ||
      r.job_id !== c.job.id ||
      r.completed_at !== c.step.completed_at
    )
      throw new Error("Successful deployment contradicts Pages result");
    // Available server contradictions must fail before any retention exception.
    this.job(await this.jobs(r.preparation), PREPARE_JOB, preparationSteps);
    // Baseline proof needs immutable preparation evidence, never expired build bytes.
    const preparationArtifact = await this.artifact(
      r.preparation,
      artifactName("preparation", r.preparation),
      false,
    );
    if (preparationArtifact.expired) throw new ExpiredPagesEvidence(candidate);
    const p = await this.record(r.preparation, "preparation");
    assertPreparedResult(p, r);
    return Object.assign(r, { baseline: candidate });
  }
  async currentRender(revision: string, remote: string): Promise<StageRecord> {
    let unavailable = false;
    for (const run of (await this.history("v2-render.yml")).sort(
      (a, b) => b.id - a.id || b.run_attempt - a.run_attempt,
    )) {
      if (run.status !== "completed" || run.conclusion !== "success") continue;
      const ref = { run_id: run.id, attempt: run.run_attempt };
      const name = `v2-stage-render-${ref.run_id}-${ref.attempt}`;
      const artifacts = (
        await this.list(`/actions/runs/${ref.run_id}/artifacts`, "artifacts")
      ).filter((a) => a.name === name);
      if (!artifacts.length) {
        unavailable = true;
        continue;
      }
      if (artifacts.length !== 1)
        throw new Error("Ambiguous exact render evidence");
      const artifact = artifacts[0];
      if (
        !Number.isSafeInteger(artifact.id) ||
        artifact.id < 1 ||
        artifact.workflow_run?.id !== ref.run_id ||
        artifact.workflow_run?.head_sha !== run.head_sha ||
        artifact.workflow_run?.head_branch !== this.branch ||
        typeof artifact.expired !== "boolean"
      )
        throw new Error("Render artifact ownership/revision mismatch");
      if (artifact.expired) {
        unavailable = true;
        continue;
      }
      const r = await this.handoff(ref, "render");
      if (r.archive_output === revision && r.remote === remote) return r;
    }
    throw new Error(
      `${unavailable ? "Unavailable render evidence; " : ""}No current verified render evidence; run render-only to renew authoritative evidence`,
    );
  }
}
export function assertPreparedResult(p: PagesRecord, r: PagesRecord) {
  if (p.outcome !== "prepared")
    throw new Error("Invalid original preparation outcome");
  for (const key of [
    "repository",
    "branch",
    "archive_branch",
    "remote",
    "archive_revision",
    "publication_identity",
    "application_sha",
    "definition_sha",
    "deployment_identity",
    "deployment_format",
    "mode",
    "force",
    "recovery",
    "recovery_reason",
    "recovery_candidate",
    "base",
    "site",
    "definition_file",
    "render",
    "origin",
    "render_record",
    "preparation",
    "artifact",
  ] as const)
    if (JSON.stringify(p[key]) !== JSON.stringify(r[key]))
      throw new Error(`Result contradicts preparation ${key}`);
}
