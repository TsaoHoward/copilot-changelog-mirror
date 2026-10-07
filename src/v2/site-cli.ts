import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { loadSitePublication } from "./site-input.js";
import { deploymentIdentity, selectSiteInputs } from "./site-identity.js";
import { buildSelectedSite } from "./site-build.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      archive: { type: "string" },
      source: { type: "string", default: process.cwd() },
      definition: { type: "string" },
      "definition-job": { type: "string" },
      base: { type: "string" },
      site: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: site-cli <identity|build> --archive DIRECTORY [--source DIRECTORY] [--definition FILE] [--definition-job JOB] [--base /PATH/] [--site https://HOST] [--output FRESH_DIRECTORY]",
    );
  } else {
    if (
      positionals.length !== 1 ||
      !["identity", "build"].includes(positionals[0]!) ||
      !values.archive
    )
      throw new Error(
        "An explicit identity or build command and --archive directory are required",
      );
    if (positionals[0] === "build" && !values.output)
      throw new Error(
        "Build requires --output pointing to a fresh directory outside the archive",
      );
    if (positionals[0] === "identity" && values.output)
      throw new Error("Identity does not accept --output");
    const source = resolve(values.source!);
    const publication = await loadSitePublication(resolve(values.archive));
    const selected = await selectSiteInputs({
      source,
      publication,
      ...(values.definition ? { definition: resolve(values.definition) } : {}),
      ...(values["definition-job"]
        ? { definitionJob: values["definition-job"] }
        : {}),
      ...(values.base ? { base: values.base } : {}),
      ...(values.site ? { site: values.site } : {}),
    });
    const output =
      positionals[0] === "build"
        ? await buildSelectedSite({
            source,
            archive: values.archive,
            output: values.output!,
            selected,
            publication,
          })
        : undefined;
    console.log(
      JSON.stringify({
        outcome: "success",
        deployment_format: 1,
        publication_identity: selected.projection.publication_identity,
        deployment_identity: deploymentIdentity(selected.projection),
        article_count: publication.length,
        ...(output ? { output } : {}),
      }),
    );
  }
} catch (error) {
  const diagnostic = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ outcome: "failure", diagnostic }));
  console.error(diagnostic);
  process.exitCode = 1;
}
