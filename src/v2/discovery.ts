import { get as getHttp } from "node:http";
import { get as getHttps } from "node:https";
import { readFile } from "node:fs/promises";
import { SaxesParser } from "saxes";
import { normalizeSourceUrl } from "./domain.js";

export const DEFAULT_FEED = "https://github.blog/changelog/label/copilot/feed/";
export interface DiscoveredArticle {
  source_url: string;
  title: string;
  published_at: string | null;
}

export async function acquire(
  input: string,
  timeoutMs: number,
): Promise<Buffer> {
  let url = normalizeSourceUrl(input);
  const signal = AbortSignal.timeout(timeoutMs);
  if (new URL(url).protocol === "file:")
    return readFile(new URL(url), { signal });
  for (let redirects = 0; redirects <= 10; redirects++) {
    const response = await new Promise<Buffer | string>((resolve, reject) => {
      const get = new URL(url).protocol === "https:" ? getHttps : getHttp;
      const request = get(
        url,
        {
          signal,
          headers: {
            "accept-encoding": "identity",
            "user-agent": "copilot-changelog-mirror/2",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const location = res.headers.location;
            res.destroy();
            if (!location)
              reject(new Error(`HTTP ${status} redirect lacks Location`));
            else resolve(location);
          } else if (status < 200 || status >= 300) {
            res.destroy();
            reject(new Error(`HTTP ${status} acquiring ${url}`));
          } else {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("end", () => {
              resolve(Buffer.concat(chunks));
            });
          }
        },
      );
      request.on("error", (error) => {
        reject(
          signal.aborted
            ? new Error(`Acquisition timed out after ${timeoutMs}ms: ${url}`)
            : error,
        );
      });
    });
    if (Buffer.isBuffer(response)) return response;
    url = normalizeSourceUrl(response, url);
    if (!["http:", "https:"].includes(new URL(url).protocol))
      throw new Error("HTTP redirects must stay within HTTP(S)");
  }
  throw new Error("Too many HTTP redirects during acquisition");
}

interface Element {
  name: string;
  attributes: Record<string, string>;
  text: string;
  children: Element[];
}
export function discover(bytes: Buffer, feedUrl: string): DiscoveredArticle[] {
  const parser = new SaxesParser({ xmlns: true });
  const stack: Element[] = [];
  let root: Element | undefined;
  parser.on("error", (error) => {
    throw new Error(`Invalid discovery XML: ${error.message}`);
  });
  parser.on("doctype", () => {
    throw new Error("Discovery documents must not contain a DOCTYPE");
  });
  parser.on("opentag", (tag) => {
    const element: Element = {
      name: tag.local,
      attributes: {},
      text: "",
      children: [],
    };
    for (const attr of Object.values(tag.attributes))
      element.attributes[attr.local] = attr.value;
    if (stack.length) stack.at(-1)!.children.push(element);
    else root = element;
    stack.push(element);
  });
  parser.on("text", (text) => {
    for (const element of stack) element.text += text;
  });
  parser.on("cdata", (text) => {
    for (const element of stack) element.text += text;
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.write(bytes.toString("utf8")).close();
  if (!root || !["rss", "feed"].includes(root.name))
    throw new Error("Invalid discovery document: expected RSS or Atom");
  let entries: Element[];
  if (root.name === "rss") {
    const channels = root.children.filter((child) => child.name === "channel");
    if (channels.length !== 1)
      throw new Error("Invalid RSS document: expected one channel");
    entries = channels[0]!.children.filter((child) => child.name === "item");
  } else entries = root.children.filter((child) => child.name === "entry");
  const articles = new Map<string, DiscoveredArticle>();
  for (const entry of entries) {
    const links = entry.children.filter((child) => child.name === "link");
    const link =
      root.name === "rss"
        ? links[0]?.text.trim()
        : links.find(
            (child) =>
              !child.attributes.rel || child.attributes.rel === "alternate",
          )?.attributes.href;
    if (!link?.trim()) continue;
    const source_url = normalizeSourceUrl(link.trim(), feedUrl);
    const title =
      entry.children.find((child) => child.name === "title")?.text.trim() ||
      source_url;
    const date = entry.children
      .find(
        (child) =>
          child.name === (root!.name === "rss" ? "pubDate" : "published"),
      )
      ?.text.trim();
    const published_at =
      date && Number.isFinite(Date.parse(date))
        ? new Date(date).toISOString()
        : null;
    const previous = articles.get(source_url);
    if (
      previous &&
      (previous.title !== title || previous.published_at !== published_at)
    ) {
      throw new Error(
        `Conflicting duplicate discovery observations: ${source_url}`,
      );
    }
    articles.set(source_url, { source_url, title, published_at });
  }
  return [...articles.values()].sort((a, b) =>
    a.source_url < b.source_url ? -1 : a.source_url > b.source_url ? 1 : 0,
  );
}
