import publication from "./publication.json";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { markdown } from "../markdown.mjs";

export interface SiteArticle {
  article_id: string;
  source_url: string;
  publication_path: string;
  title: string;
  published_at: string | null;
  body: string;
}
export const articles = (publication as SiteArticle[]).toSorted((a, b) => {
  if (a.published_at !== b.published_at) {
    if (a.published_at === null) return 1;
    if (b.published_at === null) return -1;
    return a.published_at > b.published_at ? -1 : 1;
  }
  return a.article_id < b.article_id ? -1 : a.article_id > b.article_id ? 1 : 0;
});
export const sitePath = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
export const dateLabel = (instant: string) => instant.slice(0, 10);
const processor = await createMarkdownProcessor(markdown);
export async function articleHtml(body: string) {
  return (await processor.render(body)).code;
}
