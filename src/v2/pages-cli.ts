import { parseArgs } from "node:util";
import {
  readFile,
  writeFile,
  mkdir,
  appendFile,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { git } from "./stage-writer.js";
import { PagesEvidence } from "./pages-evidence.js";
import {
  assertOwnedPath,
  verifyControl,
  selectPages,
  preparePages,
  bindPages,
  authorizePages,
  reportPages,
} from "./pages-operations.js";
import { validatePages, failPages, PAGES_WORKFLOW } from "./pages-record.js";
import type { PagesRecord } from "./pages-record.js";
async function saveState(state: string, record: PagesRecord) {
  await mkdir(dirname(state), { recursive: true });
  const temporary = await mkdtemp(join(dirname(state), ".pages-state-"));
  try {
    const file = join(temporary, "pages.json");
    await writeFile(file, JSON.stringify(record, null, 2) + "\n");
    await rename(file, state);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
let record: PagesRecord | undefined;
let state: string | undefined;
try {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string", default: process.cwd() },
      "definition-repo": { type: "string", default: process.cwd() },
      repository: { type: "string" },
      remote: { type: "string", default: "origin" },
      branch: { type: "string", default: "main" },
      "archive-branch": { type: "string" },
      state: { type: "string" },
      "run-id": { type: "string" },
      attempt: { type: "string" },
      "render-run": { type: "string" },
      "render-attempt": { type: "string" },
      "preparation-run": { type: "string" },
      "preparation-attempt": { type: "string" },
      mode: { type: "string", default: "manual" },
      force: { type: "boolean", default: false },
      reestablish: { type: "boolean", default: false },
      base: { type: "string", default: "/copilot-changelog-mirror/" },
      site: { type: "string" },
      "definition-file": {
        type: "string",
        default: ".github/v2-pages-build.json",
      },
      output: { type: "string" },
      installed: { type: "boolean", default: false },
      "artifact-id": { type: "string" },
      "job-id": { type: "string" },
      url: { type: "string" },
    },
  });
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !["select", "prepare", "bind", "authorize", "report"].includes(command!)
  )
    throw new Error("Use pages <select|prepare|bind|authorize|report>");
  state = v.state;
  if (!state) throw new Error("An invocation-owned --state file is required");
  const repo = resolve(v.repo!),
    definition = resolve(v["definition-repo"]!);
  const repository = v.repository ?? process.env.GITHUB_REPOSITORY ?? "";
  const archiveBranch = v["archive-branch"];
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !archiveBranch ||
    !/^[\w/-]+$/.test(archiveBranch) ||
    archiveBranch.includes("..") ||
    archiveBranch.startsWith("-") ||
    archiveBranch === v.branch ||
    !/^[\w/-]+$/.test(v.branch!) ||
    v.branch!.includes("..") ||
    v.branch!.startsWith("-")
  )
    throw new Error(
      "Explicit trusted repository/default branch/isolated archive branch required",
    );
  const evidence = new PagesEvidence(repository, v.branch!, archiveBranch);
  const ref = {
    run_id: Number(v["run-id"] ?? process.env.GITHUB_RUN_ID),
    attempt: Number(v.attempt ?? process.env.GITHUB_RUN_ATTEMPT),
  };
  await assertOwnedPath(state, [repo, definition]);
  await verifyControl(definition, git(definition, "rev-parse", "HEAD"));
  let event: any;
  if (process.env.GITHUB_EVENT_PATH) {
    event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
    if (
      event.repository?.full_name !== repository ||
      event.repository?.default_branch !== v.branch ||
      process.env.GITHUB_REPOSITORY !== repository ||
      process.env.GITHUB_REF !== `refs/heads/${v.branch}` ||
      git(definition, "rev-parse", "HEAD") !== process.env.GITHUB_SHA ||
      Number(process.env.GITHUB_RUN_ID) !== ref.run_id ||
      Number(process.env.GITHUB_RUN_ATTEMPT) !== ref.attempt ||
      !["workflow_run", "workflow_dispatch"].includes(
        process.env.GITHUB_EVENT_NAME!,
      )
    )
      throw new Error(
        "Actions event contradicts trusted repository/default branch/definition/exact attempt",
      );
    const self = await evidence.attempt(ref, PAGES_WORKFLOW, false);
    if (
      self.event !== process.env.GITHUB_EVENT_NAME ||
      self.head_sha !== process.env.GITHUB_SHA
    )
      throw new Error("Event contradicts server execution");
  }
  if (command === "select") {
    let render;
    let mode = v.mode;
    let force = v.force!,
      recovery = v.reestablish!;
    if ((v["render-run"] === undefined) !== (v["render-attempt"] === undefined))
      throw new Error("Supply both exact render run and attempt, or neither");
    if (v["render-run"])
      render = {
        run_id: Number(v["render-run"]),
        attempt: Number(v["render-attempt"]),
      };
    if (event) {
      if (process.env.GITHUB_EVENT_NAME === "workflow_run") {
        if (render || force || recovery || event.inputs)
          throw new Error("Automatic selection rejects manual overrides");
        mode = "automatic";
        render = {
          run_id: event.workflow_run?.id,
          attempt: event.workflow_run?.run_attempt,
        };
        if (
          event.workflow_run?.repository?.full_name !== repository ||
          event.workflow_run?.head_repository?.full_name !== repository ||
          event.workflow_run?.head_branch !== v.branch ||
          event.workflow_run?.status !== "completed" ||
          event.workflow_run?.conclusion !== "success"
        )
          throw new Error("Untrusted automatic render completion event");
      } else {
        mode = "manual";
        const inputs = event.inputs ?? {};
        if (inputs.render_run_id || inputs.render_attempt) {
          if (!inputs.render_run_id || !inputs.render_attempt || render)
            throw new Error("Partial/contradictory render selectors");
          render = {
            run_id: Number(inputs.render_run_id),
            attempt: Number(inputs.render_attempt),
          };
        }
        for (const key of ["force", "reestablish"])
          if (
            inputs[key] !== undefined &&
            ![true, false, "true", "false"].includes(inputs[key])
          )
            throw new Error("Invalid boolean publication input");
        force = inputs.force === true || inputs.force === "true" || force;
        recovery =
          inputs.reestablish === true ||
          inputs.reestablish === "true" ||
          recovery;
      }
    }
    if (
      !["manual", "automatic"].includes(mode!) ||
      (mode === "automatic" && (!render || recovery))
    )
      throw new Error("Automatic requires exact render and cannot reestablish");
    record = await selectPages({
      repo,
      definition,
      remote: v.remote!,
      evidence,
      ref,
      ...(render ? { render } : {}),
      mode: mode as "manual" | "automatic",
      force,
      recovery: recovery ? "reestablish" : "none",
      base: v.base!,
      site: v.site ?? null,
      definitionFile: v["definition-file"]!,
      ...(event?.workflow_run ? { eventSha: event.workflow_run.head_sha } : {}),
    });
  } else if (command === "authorize") {
    if (!v["preparation-run"] || !v["preparation-attempt"])
      throw new Error(
        "Authorization requires exact original preparation run/attempt; run fresh publish-only when evidence expires",
      );
    record = await evidence.preparation({
      run_id: Number(v["preparation-run"]),
      attempt: Number(v["preparation-attempt"]),
    });
    await authorizePages(repo, record, evidence, ref);
  } else {
    const value: unknown = JSON.parse(await readFile(state, "utf8"));
    validatePages(value);
    record = value;
    if (
      record.repository !== repository ||
      record.branch !== v.branch ||
      record.archive_branch !== archiveBranch ||
      record.remote !== v.remote
    )
      throw new Error("State ownership mismatch");
    const self = await evidence.attempt(ref, PAGES_WORKFLOW, false);
    if (
      self.head_sha !== record.definition_sha ||
      ref.run_id !== record.deployment.run_id ||
      ref.attempt !== record.deployment.attempt
    )
      throw new Error("State execution attempt/definition mismatch");
    if (command === "prepare") {
      if (!v.output)
        throw new Error(
          "Preparation requires a fresh --output outside input checkouts",
        );
      await preparePages(
        repo,
        definition,
        record,
        evidence,
        v.output,
        v.installed!,
      );
    } else if (command === "bind")
      await bindPages(record, evidence, Number(v["artifact-id"]));
    else if (command === "report") {
      if (["failure", "cancelled"].includes(process.env.PAGES_STATUS ?? ""))
        failPages(
          record,
          "Pages build/upload/deployment/report failed; no verified baseline established",
        );
      else if (v.url || v["job-id"])
        await reportPages(
          record,
          evidence,
          v.url!,
          v["job-id"]
            ? Number(v["job-id"])
            : evidence.job(
                await evidence.jobs(ref),
                "deploy",
                ["Deploy Pages"],
                false,
              ).id,
        );
      else if (record.outcome === "authorized")
        throw new Error("Missing deployment result URL/job association");
    }
  }
  validatePages(record!);
  await saveState(state, record!);
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `application=${record!.application_sha}\nproceed=${record!.outcome === "pending"}\ndeploy=${record!.outcome === "built" || record!.outcome === "authorized"}\npreparation_attempt=${record!.preparation.attempt}\nartifact_name=${record!.artifact?.name ?? ""}\nartifact_id=${record!.artifact?.id ?? ""}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### v2 Pages: ${record!.outcome}\n\nRender: [${record!.render.run_id}/${record!.render.attempt}](https://github.com/${repository}/actions/runs/${record!.render.run_id}/attempts/${record!.render.attempt}). Archive: ${record!.archive_revision}. Canonical identity: ${record!.publication_identity}. Deployment identity: ${record!.deployment_identity ?? "unprepared"}.\n\nPreparation: ${record!.preparation.run_id}/${record!.preparation.attempt}; deployment: ${record!.deployment.run_id}/${record!.deployment.attempt}. Baseline: ${JSON.stringify(record!.baseline)}. Recovery: ${record!.recovery} (${record!.recovery_reason ?? "none"}). ${record!.diagnostic ?? ""}\n\nSee docs/v2-pages.md for retention and recovery.\n`,
    );
  console.log(JSON.stringify(record));
  if (record!.outcome === "failure") process.exitCode = 1;
} catch (e) {
  let diagnostic = e instanceof Error ? e.message : String(e);
  // Do not serialize subprocess output or credentials into durable evidence.
  for (const secret of [process.env.GH_TOKEN, process.env.GITHUB_TOKEN])
    if (secret) diagnostic = diagnostic.replaceAll(secret, "[redacted]");
  diagnostic = diagnostic.replace(
    /https?:\/\/[^\s/@]+:[^\s/@]+@/g,
    "https://[redacted]@",
  );
  if (record) failPages(record, diagnostic);
  if (state && record)
    try {
      await saveState(state, record);
    } catch {
      console.error("Could not save failure evidence");
    }
  console.log(
    JSON.stringify(
      record ?? { version: 2, kind: "pages", outcome: "failure", diagnostic },
    ),
  );
  console.error(diagnostic);
  process.exitCode = 1;
}
