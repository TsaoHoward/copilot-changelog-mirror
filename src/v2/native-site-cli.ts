import { parseArgs } from "node:util";
import { buildArchiveSite } from "./native-site-build.js";

try {
  const { values } = parseArgs({
    options: {
      "archive-dir": { type: "string" },
      output: { type: "string" },
      base: { type: "string" },
      site: { type: "string" },
    },
    allowPositionals: false,
  });
  const result = await buildArchiveSite({
    archive: values["archive-dir"] ?? "",
    output: values.output ?? "",
    ...(values.base !== undefined ? { base: values.base } : {}),
    ...(values.site !== undefined ? { site: values.site } : {}),
  });
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      outcome: "failure",
      diagnostic: error instanceof Error ? error.message : String(error),
    }) + "\n",
  );
  process.exitCode = 1;
}
