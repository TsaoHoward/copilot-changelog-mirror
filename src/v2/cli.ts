import { parseArgs } from "node:util";
import { capture } from "./capture.js";
import { DEFAULT_FEED } from "./discovery.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string", default: process.cwd() },
      "data-branch": { type: "string", default: "mirror-data" },
      "feed-url": { type: "string", default: DEFAULT_FEED },
      "timeout-ms": { type: "string", default: "30000" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run cli -- capture [--repo PATH] [--data-branch BRANCH] [--feed-url URL] [--timeout-ms MS]",
    );
  } else {
    if (positionals.length !== 1 || positionals[0] !== "capture")
      throw new Error(
        "An explicit capture subcommand is required; use --help for usage.",
      );
    const timeoutMs = Number(values["timeout-ms"]);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      throw new Error("--timeout-ms must be a positive integer");
    const clock = process.env.COPILOT_CAPTURE_NOW;
    const result = await capture({
      repo: values.repo!,
      branch: values["data-branch"]!,
      feedUrl: values["feed-url"]!,
      timeoutMs,
      ...(clock ? { now: () => new Date(clock) } : {}),
    });
    console.log(JSON.stringify(result));
    if (result.outcome === "failure") {
      console.error(result.diagnostic);
      process.exitCode = 1;
    }
  }
} catch (error) {
  const diagnostic = error instanceof Error ? error.message : String(error);
  console.log(
    JSON.stringify({
      outcome: "failure",
      archive_input: null,
      archive_output: null,
      diagnostic,
    }),
  );
  console.error(diagnostic);
  process.exitCode = 1;
}
