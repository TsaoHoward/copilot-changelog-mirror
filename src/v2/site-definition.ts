export interface EffectiveBuild {
  node: string;
  runtime_setup: { action: string | null; runner: string };
  install: string[];
  command: string[];
  mode: string;
  environment: Record<string, string>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Build definition must contain objects");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`Unsupported build definition input: ${key}`);
}
function command(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((v) => typeof v !== "string" || !v)
  )
    throw new Error("Build commands must be non-empty string arrays");
  return value as string[];
}

/** Owned here, not by Pages. Unknown phases/configuration cannot disappear from identity. */
export function resolveBuildDefinition(
  input: unknown,
  nodePin: string,
): EffectiveBuild {
  const definition = object(input);
  keys(definition, [
    "definition_format",
    "steps",
    "environment",
    "operational",
  ]);
  if (
    definition.definition_format !== 1 ||
    !Array.isArray(definition.steps) ||
    definition.steps.length !== 3
  )
    throw new Error(
      "Unsupported build definition: expected format 1 runtime/install/build phases",
    );
  const [runtime, install, build] = definition.steps.map(object);
  keys(runtime!, ["kind", "node", "setup_action", "runner"]);
  keys(install!, ["kind", "command"]);
  keys(build!, ["kind", "command"]);
  if (
    runtime!.kind !== "runtime" ||
    install!.kind !== "install" ||
    build!.kind !== "build"
  )
    throw new Error("Unsupported build phase or phase order");
  const node =
    runtime!.node === "file:.node-version"
      ? nodePin
      : String(runtime!.node).replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(node) || node !== nodePin)
    throw new Error("Contradictory Node runtime definition and .node-version");
  const installCommand = command(install!.command);
  if (
    installCommand[0] !== "npm" ||
    installCommand[1] !== "ci" ||
    installCommand
      .slice(2)
      .some(
        (arg) =>
          ![
            "--ignore-scripts",
            "--omit=optional",
            "--no-audit",
            "--no-fund",
          ].includes(arg),
      )
  )
    throw new Error(
      "Unsupported install command; use locked npm ci with supported flags",
    );
  const buildCommand = command(build!.command);
  if (buildCommand.slice(0, 3).join(" ") !== "npm run site:astro")
    throw new Error("Unsupported build command; expected npm run site:astro");
  const args = buildCommand.slice(3);
  if (args[0] === "--") args.shift();
  const mode = args.length === 0 ? "production" : args[1];
  if (
    args.length &&
    (args.length !== 2 ||
      args[0] !== "--mode" ||
      !["production", "testing"].includes(mode!))
  )
    throw new Error(
      "Unsupported Astro build arguments; only --mode production|testing is supported",
    );
  const environment = object(definition.environment ?? {});
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(environment).sort()) {
    if (
      !["TZ", "LANG", "LC_ALL", "SOURCE_DATE_EPOCH"].includes(key) ||
      typeof environment[key] !== "string" ||
      /\$\{|\x00/.test(environment[key] as string)
    )
      throw new Error(`Unsupported or unresolved build environment: ${key}`);
    normalized[key] = environment[key] as string;
  }
  const setupAction = runtime!.setup_action ?? null;
  const runner = runtime!.runner ?? "local-linux-x64";
  if (
    (setupAction !== null &&
      (typeof setupAction !== "string" ||
        !/^actions\/setup-node@[a-f0-9]{40}$/.test(setupAction))) ||
    !["local-linux-x64", "ubuntu-latest", "ubuntu-24.04"].includes(
      String(runner),
    )
  )
    throw new Error("Unsupported runtime setup configuration");
  return {
    node,
    runtime_setup: {
      action: setupAction as string | null,
      runner: runner as string,
    },
    install: ["npm", "ci", ...new Set(installCommand.slice(2).sort())],
    command: ["npm", "run", "site:astro", "--", "--mode", mode!],
    mode: mode!,
    environment: normalized,
  };
}

/** Extract only the selected job; unknown shell/actions/phases fail closed. */
export function extractWorkflowBuild(
  input: unknown,
  jobName = "site",
): unknown {
  const workflow = object(input);
  keys(workflow, [
    "name",
    "on",
    "permissions",
    "concurrency",
    "env",
    "jobs",
    "run-name",
  ]);
  const job = object(object(workflow.jobs)[jobName]);
  keys(job, [
    "name",
    "runs-on",
    "permissions",
    "timeout-minutes",
    "concurrency",
    "steps",
    "env",
    "environment",
    "needs",
    "if",
    "outputs",
  ]);
  if (
    typeof job["runs-on"] !== "string" ||
    !["ubuntu-latest", "ubuntu-24.04"].includes(job["runs-on"])
  )
    throw new Error("Unsupported build workflow runner");
  if (!Array.isArray(job.steps))
    throw new Error("Unsupported workflow job: missing steps");
  const environment = {
    ...object(workflow.env ?? {}),
    ...object(job.env ?? {}),
  };
  for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_SHA"])
    delete environment[key];
  const steps: unknown[] = [];
  for (const raw of job.steps) {
    const step = object(raw);
    keys(step, [
      "name",
      "id",
      "uses",
      "with",
      "run",
      "env",
      "shell",
      "if",
      "working-directory",
    ]);
    if (typeof step.uses === "string") {
      if (
        step.run !== undefined ||
        step.env !== undefined ||
        step.shell !== undefined ||
        step["working-directory"] !== undefined
      )
        throw new Error("Unsupported action step build configuration");
      if (
        /^actions\/(?:checkout|upload-pages-artifact|upload-artifact|deploy-pages)@[a-f0-9]{40}$/.test(
          step.uses,
        )
      )
        continue;
      if (
        !/^actions\/setup-node@[a-f0-9]{40}$/.test(step.uses) ||
        step.if !== undefined
      )
        throw new Error(`Unsupported workflow action: ${step.uses}`);
      const config = object(step.with ?? {});
      keys(config, [
        "node-version",
        "node-version-file",
        "cache",
        "cache-dependency-path",
        "check-latest",
      ]);
      if (config["check-latest"] && config["check-latest"] !== "false")
        throw new Error("Unsupported floating Node setup");
      if (
        config["node-version"] !== undefined &&
        config["node-version-file"] !== undefined
      )
        throw new Error("Contradictory setup-node version inputs");
      if (
        config["node-version-file"] !== undefined &&
        config["node-version-file"] !== ".node-version"
      )
        throw new Error("Unsupported runtime pin location");
      const node = config["node-version-file"]
        ? "file:.node-version"
        : config["node-version"];
      steps.push({
        kind: "runtime",
        node,
        setup_action: step.uses,
        runner: job["runs-on"],
      });
    } else {
      if (
        typeof step.run !== "string" ||
        step.env !== undefined ||
        step.with !== undefined ||
        step.if !== undefined ||
        step["working-directory"] !== undefined ||
        (step.shell !== undefined && step.shell !== "bash")
      )
        throw new Error("Unsupported workflow command configuration");
      const tokens = step.run.trim().split(/\s+/);
      const kind =
        tokens[0] === "npm" && tokens[1] === "ci"
          ? "install"
          : tokens.slice(0, 3).join(" ") === "npm run site:astro"
            ? "build"
            : null;
      if (!kind)
        throw new Error(`Unsupported workflow build phase: ${step.run}`);
      steps.push({ kind, command: tokens });
    }
  }
  return { definition_format: 1, steps, environment };
}
