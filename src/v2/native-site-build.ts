import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  writeFile,
  rename,
  rm,
  symlink,
  rmdir,
} from "node:fs/promises";
import { join, resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { performance } from "node:perf_hooks";
import {
  assertRegularPath,
  loadDerivedPublication,
} from "./native-site-input.js";

const application = resolve(import.meta.dirname, "../..");
const contains = (parent: string, child: string) => {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
};
export function siteConfiguration(
  base = "/copilot-changelog-mirror/",
  site?: string,
) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*\/?$/.test(base))
    throw new Error("Base must be an absolute URL path of safe segments");
  base = base === "/" ? "/" : `${base.replace(/\/$/, "")}/`;
  if (site !== undefined) {
    const url = new URL(site);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Site must be an HTTP(S) origin without credentials, path, query or fragment",
      );
    site = url.origin;
  }
  return { base, site };
}
async function requireFreshOutput(output: string) {
  try {
    await lstat(output);
  } catch (error: any) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(
    "Build output already exists; select a fresh output directory",
  );
}
async function runTool(
  stage: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  emptyIndex = false,
) {
  await new Promise<void>((accept, reject) => {
    let diagnostics = "";
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (emptyIndex) {
      child.stdout.on("data", (chunk) => {
        diagnostics += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        diagnostics += chunk.toString();
      });
    }
    child.stdout.pipe(process.stderr, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    child.on("error", (error) =>
      reject(new Error(`${stage} could not start: ${error.message}`)),
    );
    child.on("close", (code, signal) => {
      // Locked Pagefind 1.5.2 reports its known no-content outcome with exit 1.
      // Accept only an empty publication and that diagnostic, never arbitrary failures.
      const emptyOutcome =
        emptyIndex &&
        code === 1 &&
        !signal &&
        diagnostics.includes("Found 0 files matching posts/**/*.html") &&
        diagnostics.includes("Indexed 0 pages") &&
        diagnostics.includes(
          "Error: Pagefind was not able to build an index.",
        ) &&
        diagnostics
          .split("\n")
          .filter((line) => line.startsWith("Error:"))
          .every(
            (line) =>
              line.trim() === "Error: Pagefind was not able to build an index.",
          );
      if (code === 0 || emptyOutcome) accept();
      else
        reject(
          new Error(
            `${stage} failed (${signal ?? `exit ${code}`}); no completed artifact`,
          ),
        );
    });
  });
}

/** One presentation operation; installation, archive persistence and deployment belong to callers. */
export async function buildArchiveSite(options: {
  archive: string;
  output: string;
  base?: string;
  site?: string;
}) {
  if (!options.archive?.trim() || !options.output?.trim())
    throw new Error("--archive-dir and --output are required");
  const archive = resolve(options.archive);
  const output = resolve(options.output);
  const configuration = siteConfiguration(options.base, options.site);
  await assertRegularPath(archive, "directory");
  await assertRegularPath(dirname(output), "directory", true);
  if (
    contains(archive, output) ||
    contains(output, archive) ||
    contains(application, output) ||
    contains(output, application)
  )
    throw new Error(
      "Output must be outside archive and application inputs, without overlap",
    );
  await requireFreshOutput(output);
  const start = performance.now();
  const publication = await loadDerivedPublication(archive);
  const adapter_ms = performance.now() - start;
  await mkdir(dirname(output), { recursive: true });
  const temporary = await mkdtemp(
    join(dirname(output), ".copilot-native-incomplete-"),
  );
  try {
    await symlink(
      join(application, "node_modules"),
      join(temporary, "node_modules"),
      "dir",
    );
    await writeFile(
      join(temporary, "publication.json"),
      JSON.stringify(publication),
    );
    const env = {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      COPILOT_PUBLICATION_FILE: join(temporary, "publication.json"),
      COPILOT_NATIVE_SITE: "1",
    };
    const astroStart = performance.now();
    await runTool(
      "Astro",
      [
        "--import",
        join(application, "node_modules/tsx/dist/loader.mjs"),
        join(application, "src/v2/native-site-astro.ts"),
        temporary,
        configuration.base,
        configuration.site ?? "",
      ],
      temporary,
      env,
    );
    const astro_ms = performance.now() - astroStart;
    const indexStart = performance.now();
    // Restrict scanning to article routes. Empty publications still execute the real CLI.
    await runTool(
      "Pagefind",
      [
        join(application, "node_modules/pagefind/lib/runner/bin.cjs"),
        "--site",
        join(temporary, "artifact"),
        "--glob",
        "posts/**/*.html",
      ],
      temporary,
      env,
      publication.length === 0,
    );
    const pagefind_ms = performance.now() - indexStart;
    await requireFreshOutput(output);
    await assertRegularPath(dirname(output), "directory");
    // Reserve the fresh target exclusively after both stages. rename() alone
    // could replace a directory another caller created between check and promotion.
    await mkdir(output);
    try {
      await rename(join(temporary, "artifact"), output);
    } catch (error) {
      await rmdir(output).catch(() => {}); // Remove only our still-empty reservation.
      throw error;
    }
    return {
      outcome: "success" as const,
      output,
      article_count: publication.length,
      timings: { adapter_ms, astro_ms, pagefind_ms },
    };
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(
      (error: unknown) => {
        // Cleanup is best-effort: it must neither mask a tool diagnostic nor turn
        // an already-promoted artifact into a reported build failure.
        process.stderr.write(
          `Temporary output cleanup failed at ${temporary}: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      },
    );
  }
}
