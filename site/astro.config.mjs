import { defineConfig } from "astro/config";
import { markdown } from "./markdown.mjs";

export default defineConfig({
  output: "static",
  trailingSlash: "always",
  markdown,
  vite: { build: { sourcemap: false } },
});
