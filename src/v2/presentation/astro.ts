import { build } from "astro";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const configuration = JSON.parse(await readFile(".build.json", "utf8"));
await build({
  root: resolve("site"),
  configFile: "astro.config.mjs",
  outDir: resolve("artifact"),
  cacheDir: resolve("cache"),
  base: configuration.base,
  ...(configuration.site ? { site: configuration.site } : {}),
  mode: configuration.build.mode,
  logLevel: "info",
});
