const section = document.querySelector("[data-native-search]");
const fallback = section.querySelector("[data-search-fallback]");
const bundlePath = `${section.dataset.base}pagefind/`;
const feedback = section.querySelector("[data-search-feedback]");
const observer = new MutationObserver(() => {
  feedback.textContent =
    section.querySelector(".pagefind-ui__message")?.textContent ?? "";
});
// The maintained UI displays state messages but does not expose a live region.
observer.observe(section.querySelector("#announcement-search"), {
  childList: true,
  subtree: true,
});
let ui;
let failed = false;
function unavailable() {
  if (failed) return;
  failed = true;
  observer.disconnect();
  feedback.textContent = "";
  ui?.destroy();
  fallback.textContent =
    "Search could not load. You can browse the announcements below.";
}
// Pagefind's classic UI leaves initialization/index failures as rejected promises.
// This adapter supplies the browse fallback; query/results remain Pagefind-owned.
window.addEventListener("unhandledrejection", (event) => {
  if (String(event.reason?.stack ?? event.reason).includes(bundlePath))
    unavailable();
});
// Pagefind suppresses some index-chunk failures. Observe only local search assets,
// so an unavailable shard cannot appear to be an honest empty result.
const fetchResource = window.fetch.bind(window);
const assetBase = new URL(bundlePath, location.href).href;
window.fetch = async (resource, options) => {
  const url = resource instanceof Request ? resource.url : String(resource);
  const searchAsset = new URL(url, location.href).href.startsWith(assetBase);
  try {
    const response = await fetchResource(resource, options);
    if (searchAsset && !response.ok) unavailable();
    return response;
  } catch (error) {
    if (searchAsset) unavailable();
    throw error;
  }
};
try {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${bundlePath}pagefind-ui.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  ui = new window.PagefindUI({
    element: "#announcement-search",
    bundlePath,
    baseUrl: section.dataset.base,
    noWorker: true,
    showImages: false,
    showSubResults: true,
    translations: { search_label: "Search announcements" },
  });
  section.querySelector("input").id = "announcement-query";
  fallback.textContent =
    "If search is unavailable, you can browse the announcements below.";
} catch {
  unavailable();
}
