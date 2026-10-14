import childProcess from "node:child_process";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

// Measurement only: observe actual tool subprocess starts, never substitute tools.
const spawn = childProcess.spawn;
childProcess.spawn = function (command, args, options) {
  const child = spawn(command, args, options);
  const stage = args?.some((arg) => arg.endsWith("/native-site-astro.ts"))
    ? "astro"
    : args?.some((arg) => arg.endsWith("/pagefind/lib/runner/bin.cjs"))
      ? "pagefind"
      : null;
  if (stage && process.env.COPILOT_TOOL_LOG)
    child.once("spawn", () =>
      appendFileSync(process.env.COPILOT_TOOL_LOG, `${stage}\n`),
    );
  return child;
};
syncBuiltinESMExports();
