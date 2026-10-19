import { resolve } from "node:path";
import type { TestContext } from "node:test";

export const root = resolve(import.meta.dirname, "../..");

export async function serve(
  t: TestContext,
  handler: import("node:http").RequestListener,
): Promise<string> {
  const { createServer } = await import("node:http");
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const address = server.address() as import("node:net").AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
