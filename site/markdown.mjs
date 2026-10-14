import rehypeRaw from "rehype-raw";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";

// The canonical title owns the page H1; body sections stay subordinate.
function subordinateBodyTitles() {
  return function transform(tree) {
    const ids = new Set();
    function visit(node, action) {
      action(node);
      for (const child of node.children ?? []) visit(child, action);
    }
    // Explicit archive anchors own their IDs. Generated heading slugs must not
    // duplicate them, or fragment/search navigation has an ambiguous target.
    visit(tree, (node) => {
      if (!/^h[1-6]$/.test(node.tagName) && node.properties?.id)
        ids.add(node.properties.id);
    });
    visit(tree, (node) => {
      if (node.type !== "element" || !/^h[1-6]$/.test(node.tagName)) return;
      if (node.tagName === "h1") node.tagName = "h2";
      const original = node.properties?.id;
      if (!original) return;
      let id = original;
      let suffix = 2;
      while (ids.has(id)) id = `${original}-${suffix++}`;
      node.properties.id = id;
      ids.add(id);
    });
  };
}

// Astro's native pipeline retains HTML, explicit archive anchors and media.
export const markdown = {
  gfm: true,
  smartypants: false,
  syntaxHighlight: false,
  rehypePlugins: [rehypeRaw, rehypeHeadingIds, subordinateBodyTitles],
};
