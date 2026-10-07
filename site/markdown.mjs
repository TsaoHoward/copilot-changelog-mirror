import rehypeRaw from "rehype-raw";

// The canonical title owns the page H1; body sections stay subordinate.
function subordinateBodyTitles() {
  return function visit(node) {
    if (node.type === "element" && node.tagName === "h1") node.tagName = "h2";
    for (const child of node.children ?? []) visit(child);
  };
}

// Astro's native pipeline retains HTML, explicit archive anchors and media.
export const markdown = {
  gfm: true,
  smartypants: false,
  syntaxHighlight: false,
  rehypePlugins: [rehypeRaw, subordinateBodyTitles],
};
