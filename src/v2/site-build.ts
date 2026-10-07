import { spawn } from "node:child_process";
import {
  lstat,
  readFile,
  mkdir,
  mkdtemp,
  writeFile,
  symlink,
  rename,
  rm,
  realpath,
} from "node:fs/promises";
import { join, resolve, dirname, relative, basename } from "node:path";
import type { SelectedSite } from "./site-identity.js";
import type { PublicationProjection } from "./domain.js";
import { publicationIdentity, sha256 } from "./domain.js";

/** Install beforehand with the selected lock/config; build never installs or mutates source. */
async function verifyDependencies(source: string, selected: SelectedSite) {
  const lock = JSON.parse(
    selected.files.get("package-lock.json")!.bytes.toString(),
  );
  const installedLock = JSON.parse(
    await readFile(join(source, "node_modules/.package-lock.json"), "utf8"),
  );
  for (const [path, expected] of Object.entries(lock.packages) as [
    string,
    any,
  ][]) {
    if (!path) continue;
    const installed = installedLock.packages[path];
    if (!installed && expected.optional) continue;
    if (
      !installed ||
      installed.version !== expected.version ||
      installed.integrity !== expected.integrity
    )
      throw new Error(
        `Installed dependencies disagree with selected lockfile: ${path}; run npm ci in the selected source`,
      );
  }
}
function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return !path || (!path.startsWith("../") && path !== "..");
}
export async function buildSelectedSite(options: {
  source: string;
  archive: string;
  output: string;
  selected: SelectedSite;
  publication: PublicationProjection;
}) {
  if (
    publicationIdentity(options.publication) !==
    options.selected.projection.publication_identity
  )
    throw new Error("Selected publication disagrees with deployment input");
  for (const input of options.selected.projection.inputs) {
    const file = options.selected.files.get(input.name);
    if (
      !file ||
      file.mode !== input.mode ||
      sha256(file.bytes) !== input.sha256
    )
      throw new Error(
        `Selected build input changed after identity calculation: ${input.name}`,
      );
  }
  if (options.selected.files.size !== options.selected.projection.inputs.length)
    throw new Error("Selected build input count mismatch");
  for (const name of ["site-build.ts", "site-cli.ts"]) {
    const runningBytes = await readFile(new URL(`./${name}`, import.meta.url));
    if (
      !runningBytes.equals(options.selected.files.get(`src/v2/${name}`)!.bytes)
    )
      throw new Error(
        "Selected build driver differs from executing application; invoke the selected application's site CLI",
      );
  }
  const source = await realpath(options.source);
  const archive = await realpath(options.archive);
  const output = resolve(options.output);
  // Resolve existing ancestors before creating directories, including symlink parents.
  let ancestor = dirname(output);
  const suffix: string[] = [];
  let realAncestor: string;
  for (;;) {
    try {
      realAncestor = await realpath(ancestor);
      break;
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
      suffix.unshift(basename(ancestor));
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const outputParent = join(realAncestor, ...suffix);
  const finalOutput = join(outputParent, basename(output));
  if (
    contains(archive, finalOutput) ||
    contains(finalOutput, archive) ||
    contains(finalOutput, source) ||
    contains(source, finalOutput)
  )
    throw new Error(
      "Build output must be outside archive and application source inputs",
    );
  try {
    await lstat(finalOutput);
    throw new Error(
      "Build output already exists; select a fresh invocation-owned directory",
    );
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error(
      "Unsupported execution platform; use Linux x64 for the declared static build contract",
    );
  if (
    process.versions.node !==
    options.selected.projection.configuration.build.node
  )
    throw new Error(
      "Executing Node runtime disagrees with selected build definition",
    );
  await verifyDependencies(source, options.selected);
  await mkdir(outputParent, { recursive: true });
  const staging = await mkdtemp(join(outputParent, ".copilot-site-"));
  try {
    for (const [name, file] of options.selected.files) {
      const path = join(staging, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.bytes, {
        mode: file.mode === "100755" ? 0o755 : 0o644,
      });
    }
    if (options.selected.files.has("site/src/publication.json"))
      throw new Error(
        "Reserved derived publication input exists in selected site source",
      );
    await writeFile(
      join(staging, "site/src/publication.json"),
      JSON.stringify(options.publication),
    );
    await writeFile(
      join(staging, ".build.json"),
      JSON.stringify(options.selected.projection.configuration),
    );
    await symlink(
      join(source, "node_modules"),
      join(staging, "node_modules"),
      "dir",
    );
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      ASTRO_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production",
      ...options.selected.projection.configuration.build.environment,
    };
    await new Promise<void>((accept, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "src/v2/presentation/astro.ts"],
        { cwd: staging, env, stdio: ["ignore", "pipe", "pipe"] },
      );
      child.stdout.pipe(process.stderr, { end: false });
      child.stderr.pipe(process.stderr, { end: false });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? accept()
          : reject(new Error(`Astro static build failed (exit ${code})`)),
      );
    });
    await rename(join(staging, "artifact"), finalOutput);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return finalOutput;
}
