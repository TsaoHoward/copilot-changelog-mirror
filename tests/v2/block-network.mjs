import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

function blocked() {
  appendFileSync(process.env.COPILOT_NETWORK_LOG, "attempted network access\n");
  throw new Error("Source network access blocked by offline acceptance guard");
}
http.request = http.get = https.request = https.get = blocked;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // The tsx loader uses a local IPC pipe; it is not source network acquisition.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (
    (typeof first === "string" && first.startsWith("/")) ||
    (first && typeof first === "object" && first.path)
  )
    return connect.apply(this, args);
  return blocked();
};
globalThis.fetch = blocked;
// Carry the offline guard into the real Astro subprocess, even with a clean environment.
const spawn = childProcess.spawn;
childProcess.spawn = function (command, args, options = {}) {
  return spawn(command, args, {
    ...options,
    env: {
      ...options.env,
      COPILOT_NETWORK_LOG: process.env.COPILOT_NETWORK_LOG,
      NODE_OPTIONS: "--import " + fileURLToPath(import.meta.url),
    },
  });
};
syncBuiltinESMExports();
