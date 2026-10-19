# Issue #37 cleanup evidence

Execution baseline: updated default branch `64516e9d685c2082f9fa67aeccb87d113be7c480`;
implementation branch `codex/issue-37-retire-coordination`. The checkout was clean,
`main` was fast-forward-pulled, and the issue branch was created before tracked
edits. Authority is [#37's body/specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/37#issuecomment-6249736602), preserving #32 design defaults and #24's separate historical intent.

## Retirement prerequisite

[#36's accepted final record](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6264851670)
on 2026-10-19 closes the blocker: both actual schedule events and public outcomes,
manual modes, sole production path, ordinary descendant archive history, native
known-good rollback and latest-publication restoration were accepted. Read-only
workflow inventory during cleanup showed only CI `371055837` and production
`388375554` active. The scheduler delays remain an accepted unexplained limitation;
cleanup changes neither cron/timezone nor that evidence's interpretation.

No cleanup production dispatch, activation, archive push/reset or deployment was
performed. Live production observations are reused from accepted #36 evidence;
local artifact checks below establish current command compatibility only.

## Rollback independent of removed mechanisms

Accepted known-good application `9cca716865717a50fa02066b98bfa0e2bbba247b`
and complete-derived archive `0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`
remain reachable. The old application already provides directory/native commands;
its selected rollback path imports the native CLI/build/input/domain and native
Astro presentation, without stage/Pages/cutover/identity clients or proof artifacts.
The current workflow selects its trusted fixed application while using the current
control checkout's relocated ordinary persistence helper; republish skips that
helper and both archive-writing stages.

Cleanup exported the accepted derived archive with ordinary `git archive` and ran
the **current cleaned application** `native-site-cli.ts` against it, outside the
application/archive trees. A real Astro/Pagefind rebuild succeeded for 17 articles:
adapter 21.48ms, Astro 1643.76ms, Pagefind 79.72ms (one local observation). The
retained `production-site.browser.ts` reader check passed 1/1 against this locally
served artifact in 2.56s, including the source-reviewed October 9 weekly content,
listing/order/routes/attribution/anchors/media references, actual title/body search
and result navigation. External media requests remained blocked. This is no new
hosted rollback claim: accepted production run 39122524338 supplies hosted proof.

One initial local reader attempt failed because the temporary server served `.mjs`
with an incorrect MIME type; correcting that temporary server made the unchanged
artifact pass. No production code/fixture expectation was changed for that failure.

## Archive, refs and caller audit

Read-only pre/post remote ref snapshots preserved `mirror-data-v2` and historical
tags; the v1 archive branch was also inspected afterward. No archive files occur
in the cleanup diff and `legacy/v1/` is untouched. Historical tag objects remain
locally reachable; `git fsck --full --no-reflogs` exited zero (existing dangling
objects were reported, no missing/corrupt reachable objects). #36's accepted audit
already restored and compared historical blobs/modes and current raw hashes.
Cleanup reuses that audit rather than adding a recurring checkpoint protocol.

Caller review covered static/dynamic source imports, subprocess commands, package
scripts, workflow shell/config/script references, Astro data/UI selection, test
helpers, opt-in comparison/public-reader entry points and operator links. The active
closure is directory Capture, offline Render, shared discovery/domain/normalization,
complete derived publication validation, native Astro/Pagefind and product search.
The installed workflow and tests now reference `.github/scripts/persist-stage.sh`.
No active source/build/operator/CI caller invokes the retired commands, templates,
DSL, closure identity, Actions/ZIP/API clients or cutover gates. Dated records may
mention their original paths and explicitly direct readers to fixed Git history.

Every baseline test declaration/matrix and necessary replacement assertion is
accounted for in [v2-cleanup-tests.md](v2-cleanup-tests.md). Previous full-corpus
comparison/source review records stay in the tree, with removed source/oracle/runner
inputs recoverable from the recorded baseline Git revision. Authentic metadata
extracts are taken from saved sources, with UTC expectations recorded independently;
synthetic gaps stay labeled. All remaining runtime/direct dev dependencies have
active callers; no dependency version was upgraded.

## Validation and limits

Focused migrated contracts, directory/ordinary-Git persistence, installed workflow
shell/contracts, native compiler/indexer/completion failure and integrated Chromium
checks passed during development. Final gate and two-axis review results are
recorded below when complete. [Measurements](v2-cleanup-measurements.md) separate
local CI, hosted CI, reused production observations and one-time rollback work.
#24 remains open/independent; cleanup does not supply its historical pending proof.

### Final local gates

Locked offline install, formatting and typecheck passed. The complete regular
contract suite passed **71/71** and real Chromium suite **13/13**. These totals
reflect the documented ownership changes, not a deletion/performance target.
The local 17-article known-good rollback reader check separately passed **1/1**.
No contract/browser case was skipped. `git diff --check` passed.

Read-only remote ref snapshots before/after cleanup agreed:

| Ref                                                | Target                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `mirror-data-v2`                                   | `55d5cd933dca78107957f254dea52d9c0bced333` |
| `v1-final-before-v2` (also retained `mirror-data`) | `be5b40d1fd205137939f37ced96adfe19ef0fabc` |
| `v2-initial-capture`                               | `71edf378bff29beaed88cb12906e9276ef1307f5` |
| `v2-reset-input` annotated tag                     | `894008dce71c24c98fd587793dc4bd0b6eab1b78` |
| `v2-reset-input^{}`                                | `be5b40d1fd205137939f37ced96adfe19ef0fabc` |

The first snapshot scoped archive/tag refs; `mirror-data` was independently
inspected afterward and agrees with the accepted historical checkpoint. No cleanup
operation wrote these refs. No production workflow dispatch or deployment occurred.

### Review and delivery status

The [independent two-axis review](v2-cleanup-review.md) found Standards **0** and
Spec **0** findings. Source metadata/UTC expectations were independently checked
against the original saved HTML. The reviewed implementation commit is `efadbf8`;
following edits only record review and measurement evidence.

Implementation and local verification are complete. The user then explicitly
authorized the draft PR. The reviewed branch was pushed and
[Draft PR #45](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/45) created.
[Hosted CI 39240052730](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39240052730)
passed locked install, formatting, typecheck, 71 contract checks and 13 Chromium
checks at `ae1300e0ff8a4f6d285aa494bacac32c3c2b625a`. The
[measurement record](v2-cleanup-measurements.md) now includes native before/after
step, job and end-to-end intervals, source/lock/runner/cache context and single-sample
limits. The earlier publication rejection is resolved by that explicit user request.

All required implementation, review and observation records are delivered. The PR
remains draft for the user's review; this record performs no merge or issue closure.
No production workflow dispatch, archive write or deployment was performed. #24 and
the unexplained scheduler delay remain separate from this cleanup.
