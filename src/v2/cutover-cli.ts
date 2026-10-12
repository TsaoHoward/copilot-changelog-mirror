import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { checkpointV1, verifyCutover } from "./cutover.js";

let state: string | undefined;
let result: unknown;
try {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string", default: process.cwd() },
      repository: { type: "string" },
      remote: { type: "string", default: "origin" },
      branch: { type: "string", default: "main" },
      "legacy-revision": { type: "string" },
      state: { type: "string" },
    },
  });
  state = v.state;
  if (
    positionals.length !== 1 ||
    !["checkpoint", "verify"].includes(positionals[0]!) ||
    !v.repository ||
    !/^[\w.-]+\/[\w.-]+$/.test(v.repository)
  )
    throw new Error(
      "Use cutover <checkpoint|verify> --repository OWNER/REPO [--legacy-revision SHA]",
    );
  const options = {
    repo: resolve(v.repo!),
    repository: v.repository,
    remote: v.remote!,
    branch: v.branch!,
    ...(v["legacy-revision"] ? { legacyRevision: v["legacy-revision"] } : {}),
  };
  result =
    positionals[0] === "checkpoint"
      ? await checkpointV1(options)
      : await verifyCutover(options);
  if (state) {
    await mkdir(dirname(state), { recursive: true });
    await writeFile(state, JSON.stringify(result, null, 2) + "\n");
  }
} catch (error) {
  const diagnostic = error instanceof Error ? error.message : String(error);
  result = { version: 1, outcome: "failure", diagnostic };
  if (state) {
    try {
      await mkdir(dirname(state), { recursive: true });
      await writeFile(state, JSON.stringify(result, null, 2) + "\n");
    } catch (saveError) {
      console.error(saveError);
    }
  }
  console.error(diagnostic);
  process.exitCode = 1;
}
console.log(JSON.stringify(result));
