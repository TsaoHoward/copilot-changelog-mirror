import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { Fixture, root } from "./support.js";

export function exportArchive(f: Fixture, name = "archive") {
  const archive = join(f.dir, name);
  mkdirSync(archive);
  execFileSync("tar", ["-xf", "-", "-C", archive], {
    input: f.git("archive", f.tip()),
  });
  return archive;
}

export async function siteCommand(
  f: Fixture,
  archive: string,
  command = "build",
  extra: string[] = [],
) {
  const log = join(f.dir, "site-network.log");
  rmSync(log, { force: true });
  const args = [
    "--import",
    join(root, "tests/v2/block-network.mjs"),
    "--import",
    join(root, "node_modules/tsx/dist/loader.mjs"),
    join(root, "src/v2/site-cli.ts"),
    command,
    "--archive",
    archive,
    "--source",
    root,
    ...extra,
  ];
  let response;
  try {
    response = {
      code: 0,
      ...(await promisify(execFile)(process.execPath, args, {
        cwd: f.dir,
        env: { ...process.env, COPILOT_NETWORK_LOG: log },
        maxBuffer: 8 * 1024 * 1024,
      })),
    };
  } catch (error: any) {
    response = { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
  assert.equal(
    existsSync(log) ? readFileSync(log, "utf8") : "",
    "",
    "Site build attempted network access",
  );
  return { ...response, result: JSON.parse(response.stdout) };
}

export function copySite(directory: string) {
  mkdirSync(directory);
  for (const name of [
    "site",
    "src/v2/presentation",
    "src/v2/site-build.ts",
    "src/v2/site-cli.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".node-version",
    "site-build.json",
  ]) {
    mkdirSync(join(directory, name, ".."), { recursive: true });
    cpSync(join(root, name), join(directory, name), { recursive: true });
  }
  return directory;
}
