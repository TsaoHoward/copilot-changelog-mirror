import { parseArgs } from "node:util";
import { capture } from "./capture.js";
import { render } from "./render.js";
import { DEFAULT_FEED } from "./discovery.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string", default: process.cwd() },
      "data-branch": { type: "string", default: "mirror-data" },
      "feed-url": { type: "string" },
      "timeout-ms": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: npm run cli -- <capture|render> [--repo PATH] [--data-branch BRANCH]\nCapture options: [--feed-url URL] [--timeout-ms MS]\nRender regenerates publication offline from persisted evidence; it accepts no capture options.",
    );
  } else {
    if (
      positionals.length !== 1 ||
      !["capture", "render"].includes(positionals[0]!)
    )
      throw new Error(
        "An explicit capture or render subcommand is required; use --help for usage.",
      );
    if (
      positionals[0] === "render" &&
      (values["feed-url"] !== undefined || values["timeout-ms"] !== undefined)
    )
      throw new Error(
        "Render does not accept capture options --feed-url or --timeout-ms",
      );
    const timeoutMs = Number(values["timeout-ms"] ?? "30000");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      throw new Error("--timeout-ms must be a positive integer");
    const clock = process.env.COPILOT_CAPTURE_NOW;
    const result =
      positionals[0] === "render"
        ? await render({ repo: values.repo!, branch: values["data-branch"]! })
        : await capture({
            repo: values.repo!,
            branch: values["data-branch"]!,
            feedUrl: values["feed-url"] ?? DEFAULT_FEED,
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
