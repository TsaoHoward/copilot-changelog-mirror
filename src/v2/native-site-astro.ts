import { build } from "astro";
import { resolve, join, relative } from "node:path";

const application = resolve(import.meta.dirname, "../..");
const [temporary, base, site] = process.argv.slice(2);
await build({
  root: temporary!,
  srcDir: join(application, "site/src"),
  publicDir: join(application, "site/public"),
  configFile: relative(temporary!, join(application, "site/astro.config.mjs")),
  outDir: join(temporary!, "artifact"),
  cacheDir: join(temporary!, "cache"),
  vite: { cacheDir: join(temporary!, "vite-cache") },
  base: base!,
  ...(site ? { site } : {}),
  logLevel: "info",
});
