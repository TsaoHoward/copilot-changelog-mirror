import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import TurndownService from "turndown";
import type { Article, Canonical } from "./domain.js";

const headings = "h2,h3,h4,h5,h6";
const text = (node: Cheerio<AnyNode>): string =>
  node.text().replace(/\s+/g, " ").trim();
const marker = (node: Cheerio<AnyNode>): string =>
  `${node.attr("id") ?? ""} ${node.attr("class") ?? ""}`
    .toLowerCase()
    .replaceAll("_", "-");

function hidden(node: Cheerio<AnyNode>): boolean {
  return (
    node.attr("hidden") !== undefined ||
    node.attr("aria-hidden") === "true" ||
    /(?:^|\s)(hidden|is-hidden|d-none)(?:\s|$)/.test(
      node.attr("class") ?? "",
    ) ||
    /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(node.attr("style") ?? "")
  );
}
function toc(node: Cheerio<AnyNode>): boolean {
  if (node.hasClass("js-table-of-contents-source")) return false;
  return (
    marker(node).includes("table-of-contents") ||
    /(?:^|[^a-z0-9])toc(?:[^a-z0-9]|$)/.test(marker(node))
  );
}
function tocMenu(node: Cheerio<AnyNode>): boolean {
  return (
    marker(node).includes("table-of-contents-menu") ||
    text(node).toLowerCase().startsWith("menu. currently selected:")
  );
}

/** Saved production pages can contain nested HTML/body wrappers. htmlparser2 retains them. */
function editorialRoot($: CheerioAPI): Cheerio<AnyNode> {
  const content = $(".PostContent-main.editorial-content-block").first();
  if (content.length) {
    const root = $("<div></div>");
    root.append(
      content.closest("article").find(".ChangelogFeaturedImage").clone(),
    );
    root.append(content.clone());
    return root;
  }
  for (const selector of [
    "article",
    ".wp-block-changelog-entry__content",
    ".changelog-entry__content",
    ".entry-content",
    ".wp-block-post-content",
    "body",
  ]) {
    const root = $(selector).first();
    if (root.length) return root;
  }
  return $.root();
}

function removeChrome($: CheerioAPI, root: Cheerio<AnyNode>): void {
  const candidates = new Set<AnyNode>();
  root.find("*").each((_, el) => {
    if (toc($(el))) candidates.add(el);
  });
  root.find("h2,h3").each((_, el) => {
    if (!["table of contents", "contents"].includes(text($(el)).toLowerCase()))
      return;
    const container = $(el).closest("div,nav,section");
    if (
      container[0] &&
      container[0] !== root[0] &&
      container.find("a[href^='#']").length
    )
      candidates.add(container[0]);
  });
  const roots = root
    .find("*")
    .toArray()
    .filter(
      (el) =>
        candidates.has(el) &&
        !$(el)
          .parents()
          .toArray()
          .some((parent) => candidates.has(parent)),
    );
  const retained = roots.find(
    (el) =>
      !hidden($(el)) &&
      !$(el)
        .parents()
        .toArray()
        .some((parent) => hidden($(parent))) &&
      !tocMenu($(el)),
  );
  for (const el of roots) if (el !== retained) $(el).remove();
  root.find("*").each((_, el) => {
    const node = $(el);
    if (el === retained || node.is(headings)) return;
    const role = (node.attr("role") ?? "").toLowerCase();
    if (
      node.is(
        "head,title,script,style,noscript,footer,form,button,input,nav",
      ) ||
      hidden(node) ||
      ["navigation", "menu", "button"].includes(role) ||
      [
        "site-navigation",
        "primary-navigation",
        "secondary-navigation",
        "post-terms",
        "tag-list",
        "tag-cloud",
        "taxonomy",
        "share",
        "social",
        "back-to-changelog",
        "related-post",
        "entry-meta",
        "post-meta",
        "post-date",
        "reading-time",
        "changelog-entry--footer",
      ].some((value) => marker(node).includes(value)) ||
      tocMenu(node)
    )
      node.remove();
  });
  root.find("a,span").each((_, el) => {
    if (
      ["copied", "shared", "back to changelog"].includes(
        text($(el)).toLowerCase(),
      )
    )
      $(el).remove();
  });
  root.find("article > header, h1").remove();
  if (root.is("article")) root.children("header").remove();
  root.find("img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (
      !src.trim() ||
      /^data:image\/svg\+xml/i.test(src) ||
      /(?:^|\/)placeholder[^/]*\.svg(?:[?#]|$)/i.test(src)
    )
      $(el).remove();
  });
}

function samePage(left: string, right: string): boolean {
  const a = new URL(left),
    b = new URL(right);
  return (
    a.protocol === b.protocol &&
    a.host === b.host &&
    a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "")
  );
}

function publicationInstant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const days = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1]! ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  const normalized = new Date(value).toISOString();
  return /^\d{4}-/.test(normalized) ? normalized : null;
}

function* records(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const item of value) yield* records(item);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    yield record;
    for (const item of Object.values(record))
      if (typeof item === "object") yield* records(item);
  }
}

function matchesSource(value: unknown, source: string): boolean {
  if (Array.isArray(value))
    return value.some((item) => matchesSource(item, source));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      matchesSource(record["@id"], source) || matchesSource(record.url, source)
    );
  }
  if (typeof value !== "string") return false;
  try {
    const a = new URL(value, source),
      b = new URL(source);
    return samePage(a.href, b.href) && a.search === b.search;
  } catch {
    return false;
  }
}

function structuredPublicationTime(
  $: CheerioAPI,
  article: Article,
): string | null {
  const dates = new Set<string>();
  $("script[type='application/ld+json']").each((_, el) => {
    let metadata: unknown;
    try {
      metadata = JSON.parse($(el).text());
    } catch {
      return;
    }
    for (const record of records(metadata)) {
      const kinds = Array.isArray(record["@type"])
        ? record["@type"]
        : [record["@type"]];
      if (
        !kinds.some((kind) =>
          ["Article", "TechArticle", "BlogPosting", "WebPage"].includes(
            kind as string,
          ),
        )
      )
        continue;
      if (
        ![record.url, record["@id"], record.mainEntityOfPage].some((ref) =>
          matchesSource(ref, article.source_url),
        )
      )
        continue;
      const instant = publicationInstant(record.datePublished);
      if (instant !== null) dates.add(instant);
    }
  });
  if (dates.size > 1)
    throw new Error(
      `Conflicting article-associated datePublished instants for ${article.article_id}: ${[...dates].sort().join(", ")}`,
    );
  return dates.values().next().value ?? null;
}

function headingFragments(
  $: CheerioAPI,
  root: Cheerio<AnyNode>,
  source: string,
): void {
  const ordered = root.find(headings).toArray();
  const ids = new Map<AnyNode, string>(
    ordered.map((heading, index) => [heading, `archive-heading-${index + 1}`]),
  );
  const sourceIds = new Map<string, string>();
  root.find("[id]").each((_, el) => {
    const node = $(el);
    let target = node.is(headings)
      ? el
      : (node.closest(headings)[0] ?? node.find(headings)[0]);
    if (!target && node.is("a") && !text(node)) {
      const all = root.find("*").toArray();
      target = all.slice(all.indexOf(el) + 1).find((next) => ids.has(next));
    }
    const id = target ? ids.get(target) : undefined;
    if (id && !sourceIds.has(node.attr("id")!))
      sourceIds.set(node.attr("id")!, id);
  });
  ordered.forEach((heading) => $(heading).attr("id", ids.get(heading)!));
  root.find("a[href]").each((_, el) => {
    const node = $(el),
      href = node.attr("href")!;
    const target = new URL(href, source);
    if (
      !href.startsWith("#") &&
      (!target.hash || !samePage(target.href, source))
    ) {
      node.attr("href", target.href);
      return;
    }
    if (!target.hash) return;
    const id = sourceIds.get(decodeURIComponent(target.hash.slice(1)));
    if (id) node.attr("href", `#${id}`);
    else node.removeAttr("href");
  });
}

function markdown(
  $: CheerioAPI,
  root: Cheerio<AnyNode>,
  source: string,
): string {
  root.find("img,video,source,iframe").each((_, el) => {
    for (const attr of ["src", "poster"]) {
      const value = $(el).attr(attr);
      if (value) $(el).attr(attr, new URL(value, source).href);
    }
  });
  const converter = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  converter.addRule("section-anchors", {
    filter: ["h2", "h3", "h4", "h5", "h6"],
    replacement: (content, node) =>
      `\n\n<a id="${(node as HTMLElement).getAttribute("id")}"></a>\n\n${"#".repeat(Number(node.nodeName.slice(1)))} ${content.trim()}\n\n`,
  });
  converter.addRule("embedded-media", {
    filter: ["video", "iframe"],
    replacement: (_, node) => `\n\n${(node as HTMLElement).outerHTML}\n\n`,
  });
  return (
    converter
      .turndown(root.html() ?? "")
      .replace(/\r\n?/g, "\n")
      .trim() + "\n"
  );
}

/** Converts saved source evidence only; never acquires linked content. */
export function normalizeArticle(
  bytes: Buffer,
  article: Article,
): { canonical: Canonical; body: string } {
  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const $ = load(html, { xml: { xmlMode: false } });
  const sourceArticle = $("article").first();
  const articleHeading = sourceArticle
    .find("h1")
    .filter((_, el) => Boolean(text($(el))))
    .first();
  const heading = articleHeading.length
    ? articleHeading
    : $("h1")
        .filter((_, el) => Boolean(text($(el))))
        .first();
  const title =
    text(heading) ||
    article.capture.discovery_title.trim() ||
    article.source_url;
  const published_at =
    structuredPublicationTime($, article) ??
    article.capture.discovery_published_at;
  const root = editorialRoot($);
  removeChrome($, root);
  headingFragments($, root, article.source_url);
  const body = markdown($, root, article.source_url);
  if (!body.trim()) throw new Error("Empty or unusable source HTML");
  return {
    canonical: {
      title,
      published_at,
      publication_path: `/posts/${article.article_id.replace(/-[a-f0-9]{12}$/, "")}/`,
    },
    body,
  };
}
