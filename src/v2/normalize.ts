import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import TurndownService from "turndown";
import type { Article, Canonical } from "./domain.js";
import { publicationPath } from "./domain.js";

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
  ]) {
    const root = $(selector).first();
    if (root.length) return root;
  }
  throw new Error("Unsupported editorial layout: no recognized article body");
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
  if (typeof value !== "string" || !value.trim()) return false;
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
    if (
      node.closest("table").length &&
      !node.is(headings) &&
      !node.closest(headings).length
    ) {
      sourceIds.set(node.attr("id")!, node.attr("id")!);
      return;
    }
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

/** Return Markdown only when no table structure or inline meaning is lost. */
function pipeTable($: CheerioAPI, table: Cheerio<AnyNode>): string | null {
  const structural = table.find("*").add(table).toArray();
  for (const el of structural) {
    const node = $(el);
    if (!node.is("table,thead,tbody,tr,th,td,a,em,strong,b,i,code,span"))
      return null;
    const allowed = node.is("th,td")
      ? ["class", "style", "align"]
      : node.is("a")
        ? ["class", "href", "title"]
        : ["class"];
    if (Object.keys(node.attr() ?? {}).some((attr) => !allowed.includes(attr)))
      return null;
    if (node.is("a") && !node.attr("href")) return null;
    if (node.is("code") && node.children().length) return null;
    if (node.is("code") && /[\r\n]/.test(node.text())) return null;
    if (
      node.is("th,td") &&
      node.attr("style") &&
      !/^\s*text-align\s*:\s*(left|right|center)\s*;?\s*$/i.test(
        node.attr("style")!,
      )
    )
      return null;
  }
  if (
    table.find("table").length ||
    table.children("thead").length > 1 ||
    table.children("tbody").length > 1
  )
    return null;
  const rows = table.find("tr").toArray();
  const cells = rows.map((row) => $(row).children("th,td").toArray());
  const width = cells[0]?.length ?? 0;
  if (
    !width ||
    !cells.every(
      (row, i) =>
        row.length === width &&
        row.every((cell) => $(cell).is(i === 0 ? "th" : "td")),
    )
  )
    return null;
  if (
    table.find("thead tr").length > 1 ||
    (table.find("thead tr").length && table.find("thead tr")[0] !== rows[0])
  )
    return null;
  const alignment = (cell: AnyNode): string => {
    const node = $(cell);
    const attr = node.attr("align")?.toLowerCase();
    const style = /text-align\s*:\s*(left|right|center)/i
      .exec(node.attr("style") ?? "")?.[1]
      ?.toLowerCase();
    if (attr && style && attr !== style) return "conflict";
    return style ?? attr ?? "";
  };
  const alignments = cells[0]!.map(alignment);
  for (const row of cells)
    for (const [i, cell] of row.entries()) {
      const align = alignment(cell);
      if (
        !["", "left", "right", "center"].includes(align) ||
        align !== alignments[i]
      )
        return null;
    }
  const inline = new TurndownService({
    emDelimiter: "*",
    preformattedCode: true,
  });
  const escape = inline.escape;
  inline.escape = (value) =>
    escape(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const lines = cells.map(
    (row) =>
      `| ${row.map((cell) => inline.turndown($(cell).html() ?? "").replaceAll("|", "\\|")).join(" | ")} |`,
  );
  if (lines.some((line) => /[\r\n]/.test(line))) return null;
  lines.splice(
    1,
    0,
    `| ${alignments.map((a) => (a === "left" ? ":---" : a === "right" ? "---:" : a === "center" ? ":---:" : "---")).join(" | ")} |`,
  );
  return lines.join("\n");
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
  // Protect whole processed tables from Turndown's whitespace collapsing and
  // descendant rules, including empty cells and whitespace inside HTML <pre>.
  const tables: string[] = [];
  root
    .find("table")
    .filter((_, el) => !$(el).parents("table").length)
    .each((_, el) => {
      const table = $(el);
      const converted = pipeTable($, table);
      tables.push(converted ?? $.html(el).replace(/\r\n?|\n/g, "&#10;"));
      table
        .empty()
        .attr("data-archive-table", String(tables.length - 1))
        .append("<tr><td>table</td></tr>");
    });
  converter.addRule("article-tables", {
    filter: "table",
    replacement: (_, node) =>
      `\n\n${tables[Number((node as HTMLElement).getAttribute("data-archive-table"))]}\n\n`,
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
      publication_path: publicationPath(article.source_url),
    },
    body,
  };
}
