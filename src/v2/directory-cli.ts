import { parseArgs } from "node:util";
import type { DirectoryResult } from "./directory-archive.js";

export async function directoryCli(
  stage: "capture" | "render",
  run: (values: {
    archiveDir: string;
    feedUrl?: string;
    timeoutMs?: number;
  }) => Promise<DirectoryResult<unknown>>,
): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        "archive-dir": { type: "string" },
        ...(stage === "capture"
          ? {
              "feed-url": { type: "string" as const },
              "timeout-ms": { type: "string" as const },
            }
          : {}),
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      console.log(
        `Usage: npm run ${stage}:directory -- --archive-dir PATH${stage === "capture" ? " [--feed-url URL] [--timeout-ms MS]" : ""}\nProduces validated directory output; commit and push separately with ordinary Git.`,
      );
      return;
    }
    if (!values["archive-dir"])
      throw new Error("--archive-dir PATH is required");
    const timeoutMs = Number(values["timeout-ms"] ?? 30000);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      throw new Error("--timeout-ms must be a positive integer");
    const result = await run({
      archiveDir: values["archive-dir"],
      ...(stage === "capture"
        ? {
            timeoutMs,
            ...(typeof values["feed-url"] === "string"
              ? { feedUrl: values["feed-url"] }
              : {}),
          }
        : {}),
    });
    console.log(JSON.stringify(result));
    if (result.outcome === "failure") {
      console.error(result.diagnostic);
      process.exitCode = 1;
    }
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ outcome: "failure", diagnostic }));
    console.error(diagnostic);
    process.exitCode = 1;
  }
}
