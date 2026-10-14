import { appendFileSync } from "node:fs";
let mode, log;
export function initialize(data) {
  ({ mode, log } = data);
}
export async function resolve(specifier, context, next) {
  const blocked =
    mode === "capture"
      ? /(?:^|\/)(?:normalize|render(?:-batch|-directory|-directory-cli)?)\.js$/.test(
          specifier,
        ) || /^(cheerio|turndown|astro)(?:\/|$)/.test(specifier)
      : /(?:^|\/)(?:discovery|capture(?:-batch|-directory|-directory-cli)?)\.js$/.test(
          specifier,
        );
  if (blocked) {
    appendFileSync(log, `blocked ${specifier}\n`);
    throw new Error(`Isolation guard: ${specifier} unavailable`);
  }
  return next(specifier, context);
}
