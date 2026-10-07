const region = document.querySelector("[data-search]");
const input = region.querySelector("input");
const status = region.querySelector("[role=status]");
const results = region.querySelector(".search-results");
const more = region.querySelector("[data-more]");
let engine;
let revision = 0;
let matches = [];
let shown = 0;
let assetFailed = false;
const assetBase = new URL("./pagefind/", import.meta.url).href;
const fetchResource = window.fetch.bind(window);
// Pagefind catches some shard errors. Observe its local fetches so a broken
// index cannot masquerade as no matches. Other fetches retain their behavior.
window.fetch = async (resource, options) => {
  const url = resource instanceof Request ? resource.url : String(resource);
  const searchAsset = new URL(url, location.href).href.startsWith(assetBase);
  try {
    const response = await fetchResource(resource, options);
    if (searchAsset && !response.ok) assetFailed = true;
    return response;
  } catch (error) {
    if (searchAsset) assetFailed = true;
    throw error;
  }
};
input.disabled = false;
status.textContent = "Enter words to search announcement titles and content.";

async function loadEngine() {
  if (!engine) {
    engine = import("./pagefind/pagefind.js").then((pagefind) =>
      pagefind.createInstance({
        basePath: assetBase,
        baseUrl: region.dataset.base,
        // Keep requests observable here rather than in a separate worker.
        noWorker: true,
      }),
    );
  }
  return engine;
}

function showSearchFailure(current) {
  if (current !== revision) return;
  more.hidden = true;
  status.textContent =
    "Search could not load. Reload to try again, or browse the announcements below.";
}

// Treat excerpts as text, retaining only the indexer's highlight markers.
function excerpt(content) {
  const template = document.createElement("template");
  template.innerHTML = content;
  const fragment = document.createDocumentFragment();
  function append(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) parent.append(node.textContent);
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const target =
        node.tagName === "MARK" ? document.createElement("mark") : parent;
      for (const child of node.childNodes) append(child, target);
      if (target !== parent) parent.append(target);
    }
  }
  for (const node of template.content.childNodes) append(node, fragment);
  return fragment;
}

async function showMatches(current) {
  more.hidden = true;
  status.textContent = "Searching announcements…";
  try {
    const batch = await Promise.all(
      matches.slice(shown, shown + 10).map((match) => match.data()),
    );
    if (current !== revision) return;
    if (assetFailed) throw new Error("Search assets unavailable");
    for (const match of batch) {
      const item = document.createElement("li");
      const heading = document.createElement("h3");
      const link = document.createElement("a");
      link.href = match.url;
      link.textContent = match.meta.title;
      heading.append(link);
      const summary = document.createElement("p");
      summary.append(excerpt(match.excerpt));
      item.append(heading, summary);
      results.append(item);
    }
    shown += batch.length;
    more.hidden = shown >= matches.length;
    status.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? "announcement" : "announcements"} found. Showing ${shown}.`
      : "No announcements found. Try different words.";
  } catch {
    showSearchFailure(current);
  }
}

input.addEventListener("input", async () => {
  const current = ++revision;
  const query = input.value.trim();
  results.replaceChildren();
  more.hidden = true;
  matches = [];
  shown = 0;
  if (!query) {
    status.textContent =
      "Enter words to search announcement titles and content.";
    return;
  }
  status.textContent = "Searching announcements…";
  try {
    if (assetFailed) throw new Error("Search assets unavailable");
    const pagefind = await loadEngine();
    const response = await pagefind.search(query);
    if (current !== revision) return;
    if (assetFailed) throw new Error("Search assets unavailable");
    matches = response.results;
    await showMatches(current);
  } catch {
    showSearchFailure(current);
  }
});
more.addEventListener("click", () => showMatches(revision));
