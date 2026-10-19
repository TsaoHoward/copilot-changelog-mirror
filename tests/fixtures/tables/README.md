# Table regression evidence (#41)

`model-deprecation.html` is the **complete, byte-identical** saved snapshot from
archive revision `55d5cd933dca78107957f254dea52d9c0bced333`:
`snapshots/2026-10-15-upcoming-deprecation-of-selected-github-copilot-models-in-mid-november-0fb5cf8a26c7.html`.
It was extracted from local persisted Git evidence; the original website was not
reacquired. SHA-256:
`63e0c86af2f8a6a02a4ceaa4c08b9635e8d5d39b67fddc9289be06a5f04350ed`.

`model-deprecation.broken.md` is the same revision's known flattened publication
(`posts/` with the same basename), SHA-256:
`4a40d0535d4a8b0d122548455f40504feac64ab990876b1b3f5ca453c70cefcc`.
`model-deprecation.article.json` copies that article's record from `metadata.json`,
including its original capture observations and canonical metadata.

The independent cell oracle, read from the saved HTML and recorded in the issue's
specification comment, is:

| Model | Deprecation date | Suggested alternative |
| --- | --- | --- |
| Claude Opus 4.8* | 2026-11-16 | Claude Opus 5.5 |
| Claude Opus 5 | 2026-11-16 | Claude Opus 5.5 |
| GPT-5.6 Terra | 2026-11-16 | GPT-6.1 Sol or GPT-6 Luna |

`supplemental.html` is an explicitly synthetic saved-HTML gap fixture. It covers
links, emphasis, inline code, pipes, empty cells, Unicode, multiple ordered tables,
rowspan/colspan, captions, header associations/fragment targets, a headerless table,
and forced horizontal scrolling. It is rendered by the real directory command
alongside the production evidence and shares the existing Astro/Pagefind artifact.
