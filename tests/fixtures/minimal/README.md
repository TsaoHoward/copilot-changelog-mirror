These are minimized extracts of the corresponding saved `tests/fixtures/production/`
HTML (now recoverable from Git) at capture commit `c3c50e345ad8f5c8eddd504b7934c6cc30f8dcfb`. Irrelevant
sections and image sizing attributes are removed; nested HTML/body wrappers,
editorial ancestors, and sibling responsive TOCs remain. Expectations below
come from reading the source blocks, never from running the normalizer.

| Extract / source URL suffix | Special condition | Independent expectation |
| --- | --- | --- |
| weekly-skills / 2026-09-25-github-copilot-weekly-releases-september-21 | Nested body, sibling TOC, self-linked heading and “Shared” list text | Keep JetBrains heading, all three list items and changelog link in order; keep meaningful lead image; omit sibling TOC/header framing |
| feedback-video / 2026-09-29-gpt-6-1-sol-in-github-copilot | Video and substantive feedback section, duplicated heading ID | Keep video, feedback heading and Community link in order, one usable self-link target; omit sibling TOC |
| lists-media / 2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app | Meaningful/decorative media, list emphasis, nested body | Keep two introduction paragraphs then Single/Cascade/Critique list with emphasis; omit hidden decorative lead media |

All source URLs are under `https://github.blog/changelog/`. Code blocks,
punctuation/emoji anchors, in-body TOCs, relative media and embeds are synthetic
gap cases in `github_changelog_article.html` and the normalization contract test.
They do not claim authentic captured provenance.

Condition coverage for the migration-only corpus: nested wrappers and editorial
root versus sidebar TOC → all three extracts; share/feedback → weekly-skills and
feedback-video; anchors → weekly-skills and feedback-video; lists/emphasis →
weekly-skills and lists-media; meaningful/decorative media → all extracts;
video → feedback-video. The six-article comparison is historical delivery evidence; routine gates now use
these extracts plus explicitly synthetic gaps. See `docs/v2-cleanup-tests.md`.

The #37 consolidation also copies each source's associated `TechArticle`
`@type`, `mainEntityOfPage` and `datePublished` fields into the extract. Other
structured fields are omitted. These source-reviewed literals establish metadata
precedence in the real offline Render/browser seam; no output-derived oracle is
used:

| Extract | Saved source `datePublished` | Expected UTC |
| --- | --- | --- |
| weekly-skills | 2026-09-25T09:42:48-07:00 | 2026-09-25T16:42:48.000Z |
| feedback-video | 2026-09-29T10:02:27-07:00 | 2026-09-29T17:02:27.000Z |
| lists-media | 2026-09-30T07:31:19-07:00 | 2026-09-30T14:31:19.000Z |

Each record's `mainEntityOfPage.@id` is its source URL without the trailing slash.
The complete source hashes and frozen semantic expectations remain in the
historical production fixture JSON at pre-cleanup revision
`64516e9d685c2082f9fa67aeccb87d113be7c480`; see `../production/README.md`.
Hostile metadata, ordering ties/nulls, changed-index sentinels, code/emoji anchors,
relative media, in-body TOC and iframe inputs are synthetic gap coverage, not
additional authentic captures.
