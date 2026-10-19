# Table fidelity repair for #41

Authority: [issue #41](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/41)
and its [implementation specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/41#issuecomment-6265779894).
Local verification date: 2026-10-19 (Asia/Taipei).

## Behavior and acceptance

Offline normalization now emits GFM for rectangular tables with a single leading
header row, data rows, supported inline content, and consistent column alignment.
It retains each other table as processed structural HTML, including captions,
merged cells, row headers, explicit header associations, multiple body groups,
intentional breaks, and complex content. HTML fallback follows the existing
editorial cleanup and link/media/fragment normalization. Newline entities keep
raw table blocks intact through Markdown parsing, including blank lines in preformatted
content. Generated section anchors avoid IDs retained in tables.

Cell text escapes pipe characters, tildes, and literal HTML-sensitive characters;
inline links, emphasis, code, punctuation, Unicode, and empty cells retain their
meaning. Tables remain in editorial order. The existing horizontal overflow CSS
is retained; one cell-level `overflow-wrap: normal` override prevents inherited
`anywhere` wrapping from splitting header words into letters on mobile. Desktop
and mobile screenshots demonstrated the need for this narrow correction.

The primary acceptance extends the existing shared offline artifact: saved HTML
→ real directory Render → canonical Markdown → real Astro/Pagefind build → DOM
and Chromium. The complete production snapshot and known broken derived body are
frozen with provenance in `tests/fixtures/tables/README.md`. Independently specified
expectations assert three headers and nine data cells in their exact row mapping,
plus introduction/table/footnote ordering. Synthetic saved HTML in the same build
covers inline content, empty cells, multiple ordered tables, rowspan/colspan,
header associations, captions, headerless tables, and forced horizontal scrolling.
Review regressions also pass through that actual Astro artifact.

The shared browser checks use 1280px and 320px viewports with JavaScript disabled,
semantic cell/header roles, no page-wide overflow, fragment navigation, and actual
horizontal scrolling to the wide table's final column. Existing heading/anchor,
media, list, code, search, navigation, and fallback checks remain active.

## Complete saved-archive recovery evidence

Application implementation: `474ceeefb02244e7c163fd3a540ea07cde0efbe8`.
Reviewed corrections: `fc193838ced834581192dcba3ad3b863bd08a1d8`.
Selected archive: `55d5cd933dca78107957f254dea52d9c0bced333`.

A disposable local clone selected that archive on its required `mirror-data-v2`
branch. Render and build ran with `tests/v2/block-network.mjs` loaded through
`NODE_OPTIONS` and a network-attempt log. No attempt was recorded. No original
website acquisition was performed.

First Render result:

```json
{
  "outcome": "changed",
  "counts": { "rendered": 17, "updated": 5, "unchanged": 12 }
}
```

The five changed bodies contained tables. The complete `metadata.json` and
`snapshots/` tree remained byte-identical to the selected archive, preserving all
capture observations, source identities, hashes, and canonical metadata. The
normal publication projection includes the repaired body bytes; acceptance checks
verify that it changes for the repaired production article.

Local ordinary Git persistence produced candidate archive commit
`c71f8933b37b1ff6cfafa29cfdd3b68bd8c3a353`. **This is a local validation commit,
not a pushed production archive revision.** Rerendering after persistence, and
again with the reviewed corrections, returned:

```json
{
  "outcome": "no-change",
  "counts": { "rendered": 17, "updated": 0, "unchanged": 17 }
}
```

The archive checkout was clean. Both full native builds succeeded with 17 indexed
articles. The reviewed application produced `/tmp/issue-41-recovery-site-final`.
The matching local article DOM has exactly the specified three header cells and
three ordered data rows. Chromium inspection at 1280px and 320px confirmed the
same mapping and no page-wide horizontal overflow; the mobile production table
scrolled 29px to expose its final column. Screenshots were inspected at both
widths. The automated shared artifact independently asserts the same behavior.

## Standards

Independent review against branch base
`0f96d681d1a41e2590e900722b1991c3193f5956`: no documented standards violations or
actionable Fowler-baseline smells. Tests extend the existing normalization seam
and shared browser artifact, consistent with the repository's test ownership.
Literal cell expectations at distinct seams remain independent.

## Spec

The independent initial review found three fidelity defects: literal tildes could
be interpreted as GFM strikethrough; generated section anchors could collide with
preserved table IDs; and whitespace-only inline code could disappear. All three
received failing normalization regressions and actual Astro regression coverage,
then were fixed in `fc19383`. Independent re-review ran the reproductions through
the actual Astro processor and confirmed all three resolutions. No further code
defects or unrelated scope expansion were found.

Review outcome: Standards 0 findings; Spec 0 unresolved code findings (3 resolved).
Production recovery remains pending as described below.

## Final local checks

- `npm run format:check`: passed.
- `npm run typecheck`: passed.
- `npm test`: 97/97 passed.
- `npm run test:browser`: 15/15 passed, including the shared table acceptance.
- Complete saved-archive Render, persistence, no-op rerun, Astro/Pagefind build,
  and desktop/mobile article checks: passed with source acquisition blocked.

## Remaining production completion

No production archive write or deployment has been performed for this change.
The current production workflow accepts applications only from trusted default-branch
history; the issue branch must be merged before it can repair the public site.
After merge approval, use the existing `render-rebuild` workflow on `main`, which
skips Capture, persists Render, builds, and deploys. Do not pass `archive_sha` in
this mode; it selects the current saved archive once. Preserve newer saved history.

Record the actual merged application revision, selected archive revision, Render
result, confirmed pushed repaired archive revision, Actions/deployment URL and
outcome, and public article DOM/cell mapping and mobile scroll verification.
Public recovery is not complete until those hosted and public checks succeed.
The issue remains open. Retired deployment-hash APIs have not been reinstated;
current changed/no-change results and ordinary persistence/publication remain the
contract. See `docs/v2-production-cutover.md` for the supported release path.
