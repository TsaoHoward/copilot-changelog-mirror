import { lstat, readdir, readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { publicationIdentity, sha256 } from "./domain.js";
import type { PublicationProjection } from "./domain.js";
import { parseDocument } from "yaml";
import ts from "typescript";
import {
  resolveBuildDefinition,
  extractWorkflowBuild,
} from "./site-definition.js";
import type { EffectiveBuild } from "./site-definition.js";

export interface DeploymentInput {
  name: string;
  mode: string;
  sha256: string;
}
export interface DeploymentProjection {
  deployment_format: 1;
  publication_identity: string;
  configuration: { base: string; site: string | null; build: EffectiveBuild };
  inputs: DeploymentInput[];
}
export interface SelectedSite {
  projection: DeploymentProjection;
  files: Map<string, { bytes: Buffer; mode: string }>;
}

export function normalizeBase(base = "/copilot-changelog-mirror/"): string {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*\/?$/.test(base))
    throw new Error("Base must be an absolute URL path of safe segments");
  return base === "/" ? "/" : `${base.replace(/\/$/, "")}/`;
}
function normalizeSite(site?: string): string | null {
  if (!site) return null;
  const url = new URL(site);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Site must be an HTTP(S) origin without credentials, path, query or fragment",
    );
  return url.origin;
}

/** Fixed UTF-8 JSON field order, lexical input names, one trailing LF. */
export function serializeDeploymentProjection(
  projection: DeploymentProjection,
): string {
  return (
    JSON.stringify({
      deployment_format: projection.deployment_format,
      publication_identity: projection.publication_identity,
      configuration: {
        base: projection.configuration.base,
        site: projection.configuration.site,
        build: {
          node: projection.configuration.build.node,
          runtime_setup: {
            action: projection.configuration.build.runtime_setup.action,
            runner: projection.configuration.build.runtime_setup.runner,
          },
          install: projection.configuration.build.install,
          command: projection.configuration.build.command,
          mode: projection.configuration.build.mode,
          environment: Object.fromEntries(
            Object.entries(projection.configuration.build.environment).sort(
              ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
            ),
          ),
        },
      },
      inputs: [...projection.inputs]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((input) => ({
          name: input.name,
          mode: input.mode,
          sha256: input.sha256,
        })),
    }) + "\n"
  );
}
export function deploymentIdentity(projection: DeploymentProjection): string {
  return sha256(serializeDeploymentProjection(projection));
}

export async function selectSiteInputs(options: {
  source: string;
  publication: PublicationProjection;
  definition?: string;
  definitionJob?: string;
  base?: string;
  site?: string;
}): Promise<SelectedSite> {
  const files = new Map<string, { bytes: Buffer; mode: string }>();
  async function read(name: string, optional = false) {
    let info;
    try {
      info = await lstat(join(options.source, name));
    } catch (error: any) {
      if (optional && error.code === "ENOENT") return;
      throw new Error(
        `Unreadable required build input ${name}: ${error.message}`,
      );
    }
    if (!info.isFile())
      throw new Error(`Build input must be a regular file: ${name}`);
    files.set(name, {
      bytes: await readFile(join(options.source, name)),
      mode: info.mode & 0o111 ? "100755" : "100644",
    });
  }
  async function walk(name: string) {
    const info = await lstat(join(options.source, name));
    if (!info.isDirectory())
      throw new Error(`Build source must be a directory: ${name}`);
    for (const child of (await readdir(join(options.source, name))).sort()) {
      if (name === "site" && [".astro", "dist", "node_modules"].includes(child))
        continue;
      const path = `${name}/${child}`;
      if (/^\.env(?:\.|$)/.test(child))
        throw new Error(`Unsupported ambient build configuration: ${path}`);
      const stat = await lstat(join(options.source, path));
      if (stat.isDirectory()) await walk(path);
      else await read(path);
    }
  }
  await walk("site");
  await walk("src/v2/presentation");
  for (const name of ["site/astro.config.mjs", "src/v2/presentation/astro.ts"])
    if (!files.has(name))
      throw new Error(`Missing required build input: ${name}`);
  for (const name of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".node-version",
    "src/v2/site-build.ts",
    "src/v2/site-cli.ts",
  ])
    await read(name);
  await read(".npmrc", true);
  for (const name of await readdir(options.source))
    if (
      /^\.env(?:\.|$)/.test(name) ||
      [".nvmrc", "npm-shrinkwrap.json"].includes(name)
    )
      throw new Error(`Unsupported ambient build configuration: ${name}`);
  const packageFile = JSON.parse(files.get("package.json")!.bytes.toString());
  const lock = JSON.parse(files.get("package-lock.json")!.bytes.toString());
  for (const hook of [
    "preinstall",
    "install",
    "postinstall",
    "prepublish",
    "prepare",
    "preprepare",
    "postprepare",
    "presite:astro",
    "postsite:astro",
    "presite:build",
    "postsite:build",
    "presite:identity",
    "postsite:identity",
  ]) {
    if (packageFile.scripts?.[hook] !== undefined)
      throw new Error(`Unsupported npm lifecycle build phase: ${hook}`);
  }
  if (
    packageFile.packageManager !== undefined ||
    packageFile.devEngines !== undefined
  )
    throw new Error(
      "Unsupported competing package-manager/runtime configuration",
    );
  const tsconfig = JSON.parse(files.get("tsconfig.json")!.bytes.toString());
  if (
    tsconfig.extends !== undefined ||
    tsconfig.compilerOptions?.paths !== undefined ||
    tsconfig.compilerOptions?.baseUrl !== undefined
  )
    throw new Error(
      "Unsupported external or aliased TypeScript build configuration",
    );
  if (lock.lockfileVersion !== 3 || !lock.packages?.[""])
    throw new Error("Expected npm lockfile version 3");
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ]) {
    const sorted = (v: Record<string, string> = {}) =>
      JSON.stringify(Object.entries(v).sort());
    if (sorted(packageFile[field]) !== sorted(lock.packages[""][field]))
      throw new Error(
        `Contradictory package/lock ${field}; run npm ci against matching locked inputs`,
      );
  }
  const nodePin = files
    .get(".node-version")!
    .bytes.toString()
    .trim()
    .replace(/^v/, "");
  if (!/^22\.\d+\.\d+$/.test(nodePin))
    throw new Error(
      "Unsupported Node runtime pin; expected exact Node 22 version",
    );
  const document = parseDocument(
    await readFile(
      options.definition ?? join(options.source, "site-build.json"),
      "utf8",
    ),
    { uniqueKeys: true, strict: true },
  );
  if (document.errors.length || document.warnings.length)
    throw new Error(
      `Unsupported or malformed build definition: ${[...document.errors, ...document.warnings].map((error) => error.message).join("; ")}`,
    );
  const definition = document.toJS({ maxAliasCount: 0 });
  const build = resolveBuildDefinition(
    definition?.jobs
      ? extractWorkflowBuild(definition, options.definitionJob)
      : definition,
    nodePin,
  );
  const script = packageFile.scripts?.["site:astro"];
  if (script !== "node --import tsx src/v2/presentation/astro.ts")
    throw new Error("Unsupported site:astro build entry point");
  if (
    packageFile.type !== "module" ||
    packageFile.engines?.node !== ">=22.22.0 <23"
  )
    throw new Error("Unsupported package runtime configuration");
  const npmrc = files.get(".npmrc")?.bytes.toString() ?? "";
  if (
    npmrc
      .split(/\r?\n/)
      .some(
        (line) =>
          line.trim() &&
          !/^(?:#|;|(?:audit|fund|engine-strict|ignore-scripts)=(?:true|false)$|omit=optional$)/.test(
            line.trim(),
          ),
      )
  )
    throw new Error("Unsupported npm install configuration in .npmrc");
  // Exclude unrelated capture/test scripts and descriptive package metadata.
  const selectedPackage = {
    type: packageFile.type,
    engines: packageFile.engines,
    dependencies: packageFile.dependencies,
    devDependencies: packageFile.devDependencies,
    optionalDependencies: packageFile.optionalDependencies,
    scripts: { "site:astro": script },
  };
  function stable(value: any): any {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, stable(value[key])]),
      );
    return value;
  }
  files.set("package.json", {
    bytes: Buffer.from(JSON.stringify(stable(selectedPackage))),
    mode: "100644",
  });
  files.set(".node-version", {
    bytes: Buffer.from(nodePin + "\n"),
    mode: files.get(".node-version")!.mode,
  });
  // Parse imports rather than guessing from text: comments and literal URLs are not dependencies.
  for (const [name, file] of files) {
    if (
      (!name.startsWith("site/") && !name.startsWith("src/v2/presentation/")) ||
      !/\.(?:[cm]?[jt]sx?|astro)$/.test(name)
    )
      continue;
    const text = file.bytes.toString();
    const code = name.endsWith(".astro")
      ? [
          text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "",
          ...[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
            (match) => match[1],
          ),
        ].join("\n")
      : text;
    const syntax = ts.createSourceFile(
      name,
      code,
      ts.ScriptTarget.Latest,
      true,
      name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function checkSpecifier(specifier: string) {
      if (specifier.startsWith("node:")) return;
      if (
        specifier.startsWith("/") ||
        /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(specifier) ||
        specifier.includes("\\")
      )
        throw new Error(
          `Unsupported uncovered build import ${specifier} in ${name}`,
        );
      if (!specifier.startsWith(".")) return; // npm package inputs are locked separately.
      const imported = posix.normalize(
        posix.join(posix.dirname(name), specifier),
      );
      if (
        !imported.startsWith("site/") &&
        !imported.startsWith("src/v2/presentation/")
      )
        throw new Error(
          `Uncovered website helper ${specifier} in ${name}; move it into the presentation source roots`,
        );
    }
    function inspect(node: ts.Node): void {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        checkSpecifier(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        const argument = node.arguments[0];
        if (
          node.arguments.length !== 1 ||
          !argument ||
          (!ts.isStringLiteral(argument) &&
            !ts.isNoSubstitutionTemplateLiteral(argument))
        )
          throw new Error(`Unsupported dynamic build import: ${name}`);
        checkSpecifier(argument.text);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(syntax);
  }
  return {
    files,
    projection: {
      deployment_format: 1,
      publication_identity: publicationIdentity(options.publication),
      configuration: {
        base: normalizeBase(options.base),
        site: normalizeSite(options.site),
        build,
      },
      inputs: [...files]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, file]) => ({
          name,
          mode: file.mode,
          sha256: sha256(file.bytes),
        })),
    },
  };
}
