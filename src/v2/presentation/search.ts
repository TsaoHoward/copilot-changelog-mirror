import * as pagefind from "pagefind";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function check(errors: string[]) {
  if (errors.length)
    throw new Error(`Pagefind indexing failed: ${errors.join("; ")}`);
}

/** Index only freshly rendered canonical articles, never the listing or evidence. */
export async function indexArticles(
  artifact: string,
  articles: readonly { publication_path: string }[],
) {
  if (!articles.length) return;
  try {
    const created = await pagefind.createIndex({ keepIndexUrl: false });
    check(created.errors);
    if (!created.index) throw new Error("Pagefind did not create an index");
    for (const article of articles) {
      const content = await readFile(
        join(artifact, article.publication_path, "index.html"),
        "utf8",
      );
      const result = await created.index.addHTMLFile({
        url: article.publication_path,
        content,
      });
      check(result.errors);
    }
    check(
      (
        await created.index.writeFiles({
          outputPath: join(artifact, "pagefind"),
        })
      ).errors,
    );
    // Do not expose a successful artifact with a missing browser entry point.
    await readFile(join(artifact, "pagefind/pagefind.js"));
    await readFile(join(artifact, "pagefind/pagefind-entry.json"));
  } finally {
    await pagefind.close();
  }
}
