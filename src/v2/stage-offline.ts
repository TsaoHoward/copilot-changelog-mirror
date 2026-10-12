// Loaded only in the application render subprocess. Operational Git/API traffic stays outside.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
let attempted = false;
function blocked(): never {
  attempted = true;
  if (process.env.COPILOT_NETWORK_LOG)
    appendFileSync(
      process.env.COPILOT_NETWORK_LOG,
      "attempted network access\n",
    );
  throw new Error("Offline render attempted source network acquisition");
}
http.request = http.get = https.request = https.get = blocked;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (
  this: net.Socket,
  ...args: Parameters<typeof connect>
) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (
    (typeof first === "string" && first.startsWith("/")) ||
    (first && typeof first === "object" && "path" in first && first.path)
  )
    return Reflect.apply(connect, this, args);
  return blocked();
} as typeof connect;
globalThis.fetch = blocked;
syncBuiltinESMExports();
process.on("exit", () => {
  if (attempted) process.exitCode = 1;
});
