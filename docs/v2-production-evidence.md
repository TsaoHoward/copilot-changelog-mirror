> Dated #36 audit/activation evidence. The final 2026-10-19 acceptance is appended
> below; earlier Pending rows retain their original observation dates. Historical
> migration commands/paths are recoverable from Git revision
> `64516e9d685c2082f9fa67aeccb87d113be7c480`; use the
> [current runbook](v2-production-cutover.md) for operation.

# Issue #36 production preparation and observation

**Production manual acceptance and rollback passed; both real schedule observations Pending.** The preparation record below is historical. See the dated activation section for current status. #36 remains Open. Authority:
[#36 body and specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6214593750),
parent #32, prerequisite #35. This record does not close #24. No production
workflow was disabled/enabled/dispatched, no archive ref changed, and no new
Pages deployment was requested by preparation PR #42. The later authorized activation is recorded below.

## Decisions and prerequisite

Inspected 2026-10-16. Application default `main` was fast-forwarded to
`81b7df4dbf2fb75f61a9752c519e80bf8f4c73f7` before creating the fresh
`codex/issue-36-production-cutover` branch. [PR #40](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/40)
is merged there, including the isolated template and
[#35's functional evidence](v2-isolated-workflow-evidence.md).

Status rechecked **2026-10-18 (Asia/Taipei)**: [#35](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/35)
is **Closed — Completed**. Its closure records acceptance of the isolated functional
evidence (full-update, Capture-persisted/Render-failed boundary, offline repair,
known-good republish, native Pages and public browsing/search). The real isolated
schedule observation remains **Pending**, independently of that completed functional
acceptance. This status correction does not revise the historical results below.
Record the accepted evidence and delivered revision on #36, and obtain a separate,
explicit production activation decision before executing the
[cutover runbook](v2-production-cutover.md). Closing #35 or merging this preparation
does not authorize production activation or pass #36's production acceptance;
activation and production acceptance remain **Pending**.

| Required observation / decision                                              | State              | Evidence / next step                                                                    |
| ---------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Delivered #35 interfaces and isolated functional evidence available          | Passed inspection  | PR #40, default SHA above, retained isolated evidence; no new isolated dispatch         |
| Human acceptance of replacement functional evidence                          | Passed (#35)       | #35 closure accepts PR #40's isolated functional evidence; reference it on #36          |
| Explicit production activation decision                                      | Pending            | Record separate approval and coordinated operating window                               |
| Current archive/raw/schema and restored checkpoint recoverability            | Passed preparation | Dated inventory and Git checks below; repeat if refs advance before drained boundary    |
| Compatible complete-derived native build/index                               | Passed locally     | Fixed pair, fresh install/output, 17 indexed articles below                             |
| Stop/drain and sole active replacement path, no late old deployment          | Pending            | Old chain still active; execute runbook only after decisions                            |
| First replacement finished build/upload/native publication and reader checks | Pending            | Current old-site reader check passed; it is not replacement publication                 |
| Descendant history/retained identities/raw preservation after transition     | Pending            | Compare drained inventory with actual new C/R and republish refs                        |
| Production manual full-update                                                | Pending            | Authorized safe real-source run after activation                                        |
| Production persisted-source render-rebuild                                   | Pending            | Confirm Capture skipped and raw bytes/fields preserved                                  |
| Production saved-derived republish / known-good native rollback              | Pending            | Local rebuild passed; native dispatch and subsequent public checks still required       |
| Actual new 06:17 Taipei schedule event and public outcome                    | Pending            | Observe first opportunity after activation; configuration is not execution              |
| Actual new 12:17 Taipei schedule event and public outcome                    | Pending            | Observe separately; record platform delay/missing/failure honestly                      |
| Comparable new production costs                                              | Pending            | Old baseline below; measure full new workflow with conditions and failed/extra attempts |

## Read-only migration audit

At **2026-10-16 12:30:05 UTC / 20:30:05 Asia/Taipei**, a fresh mirror clone
restored the current archive and retained checkpoint to disposable directories.
The durable [input inventory](v2-production-audit.json) records every current
article's immutable identity, canonical fields, Capture metadata, snapshot hash
and body hash. It is a human audit export, not a runtime protocol or live-state
lease. Production refs may advance; refresh at the drained cutover boundary.

| Input                                                             | Revision / result                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Application / workflow baseline                                   | `81b7df4dbf2fb75f61a9752c519e80bf8f4c73f7`                                                                     |
| Complete-derived archive                                          | `8d38d259c0c4f9e6ea7216eb9fd6e4b8cf2db0bb`                                                                     |
| Preceding Capture (also reported by old Render/Pages native logs) | `3aeea0a2484fa5566a0397022f8054fc7d5a3fdc`                                                                     |
| Current archive tree                                              | `044e5a8be92e5ea97ecc894ea9d3412695fd52f1`                                                                     |
| Current schema / inventory                                        | v2; 17 identities, 17 raw HTML, 17 complete bodies; 35 restored files; 15 reachable commits                    |
| Historical checkpoint and unchanged `mirror-data`                 | `be5b40d1fd205137939f37ced96adfe19ef0fabc`                                                                     |
| Checkpoint tree                                                   | `cf9f357a9b1f18bab2de45b4f5dfdb8a35fa0710`                                                                     |
| Restored historical content                                       | 66 original files: 21 HTML, 21 JSON sidecars, 24 Markdown with original front matter; 43 reachable commits     |
| Initial Capture witness                                           | `71edf378bff29beaed88cb12906e9276ef1307f5`; confirmed ancestor of current archive                              |
| Annotated historical reset proof object                           | `894008dce71c24c98fd587793dc4bd0b6eab1b78`; peeled target is checkpoint above; recorded initial archive absent |

All 66 historical and 35 current exported files were compared against their
original Git blob IDs and executable modes. Full mirrored-object `git fsck
--full --no-reflogs` returned clean; schema/identity/route validation and every raw
SHA-256 matched. These checks restore actual saved bytes and reachable history;
ref existence alone was not used as proof. The reset proof was read without
recreating it. No unknown checkpoint-operation ordering was inferred. No historic
Actions artifact was needed. All retained refs survived; no remote write occurred.

The fixed application/archive pair built with a **fresh `npm ci --offline`** using
the existing local npm download cache, Node 22.22.0/npm 10.9.4, and new output.
Lock SHA-256: `7062f8445365011714769409b0b94c574894960773e23ae2aba2c474f514e8dd`.
Astro 7.3.6 generated 18 HTML routes (listing plus 17 articles); Pagefind 1.5.2
indexed 17 pages / 1110 words. Command result: success, adapter 17.65 ms, Astro
1429.62 ms, Pagefind 45.06 ms. One local sample, Ubuntu/WSL existing package cache;
this is compatible-input/output proof, not production pipeline cost or hosted
rollback. Existing Astro markdown deprecation notices did not prevent completion.

## Current native state and reader baseline

Read-only workflow inventory found active old IDs `381740224` (Capture),
`381740225` (Render), `381887694` (Pages), plus CI. The new template is unregistered.
The most recent old chain inspected was:

- [Capture 38878058051](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38878058051):
  actual `schedule`, 2026-10-16 09:05:25 UTC / 17:05:25 Taipei, successful.
- [Render 38878183730](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38878183730):
  `workflow_run`, successful, complete-derived output matching the inventory.
- [Pages 38878306362](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38878306362):
  `workflow_run`, successful; native deployment `7115246226` status `success` at
  09:09:28 UTC / 17:09:28 Taipei, application SHA matching the baseline.

At **12:32:57 UTC / 20:32:57 Taipei**, read-only Chromium inspection of
[the existing public site](https://tsaohoward.github.io/copilot-changelog-mirror/)
passed against the fixed complete saved inputs: 17 listing entries in canonical
date/order, all routes/titles/dates/source links, the October 9 weekly article's
saved prose, heading anchor navigation and image/video references, title query
`weekly releases`, body query `enterprise-provided`, and navigation to the result.
All requested local assets/search resources returned successfully. External media
requests were blocked; this proves retained references, not remote availability.
The same opt-in reader script passed against the locally rebuilt replacement
artifact at the repository base at 12:32:24 UTC. One harness correction changed
`video source` to `video` because this source uses direct `video[src]`; the first
local check failed that incorrect selector, then the corrected local/public checks
passed. No product code or saved evidence was changed to satisfy it.

This baseline does not establish drained quiescence, prevent future old reruns,
or prove replacement publication. Inspect native state and actual content again
after any invoked deployment with ambiguous response/status; a failed response
alone cannot establish old-site preservation.

## Historical nominal-time discrepancy

The original event is [Capture 38339933118](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38339933118),
`event=schedule`, definition/head `eef5ebb57db4c96717d08e4859da66ebbd86c45b`, created
and run-started **2026-10-13 03:04:14 UTC / 11:04:14 Taipei**. Native job start was
03:04:17 UTC (3 seconds later), completion 03:05:10 UTC; conclusion success.
Reading that exact revision's YAML confirmed `17 6,12 * * *` with `Asia/Taipei`.
The next observed old event that day was 11:53:58 UTC / 19:53:58 Taipei.

**Unresolved.** Native run/job metadata and available logs do not expose a reliable
nominal scheduled-for instant or scheduler explanation. 11:04 is 4h47m14s after
the nominal 06:17 opportunity and before 12:17, but this arithmetic is not proof
of slot attribution or platform delay. The 3-second job wait does not explain
creation time. No timezone or schedule change was made. Next investigation: retain
original event/platform diagnostics (or request GitHub scheduler investigation),
then separately record both actual new scheduled opportunities after activation.
A later successful event or manual run cannot fill either pending #36 row.

## Production cost baseline (old chain only)

Single successful chain above, no repeated-sample or cold-install claim. All jobs
used `ubuntu-latest`, observed Ubuntu 24.04 image `20261012.334.1`, Node 22.22.0,
npm 10.9.4, restored npm cache key
`node-cache-Linux-x64-npm-5bd78caab370a3b3aabc9cf8660d17fa327faaa4870fd509bc288bd278d85309`.
Application/definition and lock match above; archive input before Capture was
`4fd63e03d534f41e6d1fa38a4311baa3f26ab644`, selected rendered corpus 17 articles,
repository base `/copilot-changelog-mirror/`, normal advancing old-chain mode.
Native step endpoints are second-granularity; grouped stages include persistence
and operational checks, so finer acquisition/push/index subcosts are unavailable.

| Job           | Start–finish UTC  | Execution seconds | Recorded operation intervals (seconds)                                                                      |
| ------------- | ----------------- | ----------------: | ----------------------------------------------------------------------------------------------------------- |
| Capture       | 09:05:29–09:06:28 |                59 | setup-node 8; control install 4; selected-app install 4; selection 1; Capture/persist 33; evidence upload 1 |
| Render        | 09:06:34–09:07:31 |                57 | setup-node 8; control install 5; selected-app install 4; selection 1; Render/persist 29; evidence upload 1  |
| Pages prepare | 09:07:37–09:08:39 |                62 | setup-node 8; install 4; selection 16; build 20; Pages upload 2; bind/report/evidence steps separate        |
| Pages deploy  | 09:08:44–09:09:28 |                44 | setup-node 9; install 4; authorization 12; native deploy 7; reporting/evidence separate                     |

Three workflow invocations, four jobs, six explicit installs (25 seconds total
native install intervals), plus a locked install inside Pages prepare's selected
site build (one required invocation confirmed by tracing the executed prepare
path; included in its 20 seconds, precise install interval not separately exposed).
Seven installs overall, with that nested invocation identified from code rather
than a separately named native step. Job execution sum 222 seconds;
creation-to-final-run-update pipeline 09:05:25–09:09:29 = 244 seconds. Run creation
to first job: Capture 4s, Render 4s, Pages prepare 3s; prepare→deploy gap 5s.
Cross-workflow handoffs: Capture completed run 09:06:29 to Render creation
09:06:30 = 1s; Render completed run 09:07:32 to Pages creation 09:07:34 = 2s.
These times include different service/queue/report boundaries, not a single CPU
measurement. Pagefind timing is bundled in build; no fabricated split is claimed.

New production cost is **pending**. The reviewed workflow structurally has one
install in archive/build and none in deploy; any speed/cost improvement remains an
inference until comparable real production runs. Isolated #35 measurements and
local preparation/CI timings are separate evidence layers.

## Local validation and review

Focused configuration and actual entry-shell tests passed for production and
isolated guards; the production template retains independent ordinary persistence,
fixed checkouts, supported modes and same-workflow native permissions/dependency
gates. Real-Git failure/persistence tests remain with #35; schema and native build
failure tests remain with #33/#34. No failure was injected into production.

Final verification uses Node 22.22.0/npm 10.9.4, existing application dependencies
and Chromium cache. No cold CI/runtime savings are claimed. Local verification
performed no production dispatch or archive write.

- Formatting, TypeScript and `git diff --check`: passed.
- Production/isolated YAML, actual entry shell and existing real-Git persistence:
  11 focused checks passed.
- Future installed layout in a disposable copy: 6 production/isolated workflow
  checks and 2 retained historical wiring checks passed after moving old definitions
  outside registration and copying the new template into place.
- Retained Chromium gates: 31 passed, 0 failed/skipped (25.383 seconds reported).
- Final opt-in reader check including repository-base asset assertions: local
  artifact passed at 12:39:01 UTC / 20:39:01 Taipei; current public site passed at
  12:39:11 UTC / 20:39:11 Taipei (9.414 seconds reported for public check).
- First full-suite invocation began before the changed `package.json` was committed:
  311 passed / 23 failed (173.400 seconds). Legacy operational fixtures require a
  clean committed control source and refused that dirty source; later upstream
  evidence/remote-state assertions consequently lacked durable results. This is a
  recorded verification-order mistake, not accepted feature behavior. After the
  preparation commit, all 10 `stage-writer.test.ts` checks passed (17.000 seconds).
  The complete clean-source rerun passed **337/337**, 0 failures/skips
  (166.997 seconds reported). The failed attempt's count was lower because failed
  parent cases did not execute all their nested checks.

### Standards

Independent reviewer of `81b7df4...9d48d2a`: 0 documented violations and 0
actionable baseline smells. Fixed inputs, separate pushes, guarded activation,
restoration and executable rollback were checked. The reviewer requested that
this final verification footer be completed; it is recorded here.

### Spec

Independent reviewer: 0 actionable findings or scope creep. Dormant installation,
production feed/base and guards, runbook, real recoverability/local build and
old-site baseline implement the authorized preparation. The corrected checkpoint
counts match the inventory. Hosted acceptance is correctly pending as required by
“If activation remains unauthorized, report implementation preparation separately
from pending activation/acceptance; do not claim #36 complete.”

Review totals: Standards 0; Spec 0. Activation, hosted rollback, both new schedules
and new production costs remain pending regardless of local results.

## Production Activation — 2026-10-18 Asia/Taipei

The user separately accepted #35's isolated functional evidence delivered by PR #40
(`81b7df4dbf2fb75f61a9752c519e80bf8f4c73f7`) and explicitly authorized production
activation in the current operating window. Both decisions are recorded in
[#36 operation comment](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6248994488).
The first precisely captured operation timestamp is **18:56:03 Asia/Taipei**;
18:53 in that initial comment is an approximate initial-read time, not a measured
event timestamp. Isolated scheduled observation remains Pending independently.
#24 is unchanged; #37 has not started. Retired guarantees remain as described in
the runbook; they do not sign off #24.

### Gate 1 — Passed (18:58 Asia/Taipei)

Fresh remote mirror, not preparation refs: `main`
`9cca716865717a50fa02066b98bfa0e2bbba247b` (PR #42 merged; CI
[39115871075](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39115871075)
success); archive `0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`, tree
`150f9fc9dc03f53aed09eb32e354517f25e0d665`, 20 reachable commits. All 17
identities retained since preparation. Current schema v2 validates; 17 raw HTML,
17 complete canonical bodies, Capture metadata and every snapshot SHA-256 pass.
The archive advanced by five ordinary Capture/Render commits since the preparation
baseline. Canonical bodies match the last actual publication at
`5dc00f3b932bf4979f157752bf6a2d5aceb4768e`; later raw acquisitions remain intact.

A fresh mirror `fsck --full --no-reflogs` passed. Disposable exports verified every
file blob and executable mode: checkpoint 66 files / 43 reachable commits, current
archive 35 files, and application 179 files. Historical HTML, JSON sidecars and
Markdown front matter inspected. `mirror-data` and `v1-final-before-v2` remain
`be5b40d1fd205137939f37ced96adfe19ef0fabc`, tree
`cf9f357a9b1f18bab2de45b4f5dfdb8a35fa0710`;
`v2-reset-input` annotated object `894008dce71c24c98fd587793dc4bd0b6eab1b78`
peels to that checkpoint. Its historical payload was read, not recreated.
`v2-initial-capture` `71edf378bff29beaed88cb12906e9276ef1307f5` remains an
ancestor of current archive. Previous complete-derived `8d38d259...` also restored
and verified. No inferred historical ordering, archive write or old artifact used.

Current verified known-good recovery pair: application
`9cca716865717a50fa02066b98bfa0e2bbba247b`, complete-derived archive
`0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`. Fresh locked npm install from local
cache, Node 22.22.0/npm 10.9.4; Astro 7.3.6 built 18 routes, Pagefind 1.5.2
indexed 17 pages / 1114 words in a new output directory. Adapter 18.96 ms,
Astro 1453.67 ms, Pagefind 45.58 ms. First sandboxed install failed on process
permissions; elevated retry passed with unchanged lock/toolchain. These are local
recovery checks, not hosted costs. Native recovery after sole-chain activation:
`gh workflow run update-publish.yml --ref main -f mode=republish -f application_sha=9cca716865717a50fa02066b98bfa0e2bbba247b -f archive_sha=0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`.

Local reader check passed at **18:58:24**, public reader baseline at **18:58:06**:
17 ordered listing entries, all routes/titles/dates/source links, representative
saved prose, anchors, image/video references, repository-base assets, title query
`weekly releases`, body query `enterprise-provided`, and result navigation.
External media requests were blocked; references, not remote availability, verified.

Live workflow inventory: CI `371055837`, old Capture `381740224`, Render
`381740225`, Pages `381887694`, all active. Capture has schedule/dispatch;
Render and Pages dispatch/workflow_run; all production definitions use whole-workflow
`copilot-archive-production`, no cancellation, `queue: max`. CI has push/PR only.
No other registered writer/deployer found. Repository-wide queued, in_progress,
waiting, pending and requested inventories empty. Replacement not registered.
Pages uses native workflow deployment, HTTPS, environment `github-pages`, branch
policy `main`. Last actual public deployment **7132459232**, status success,
[Pages 38987096817](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38987096817),
application `81b7df4...`, archive `5dc00f3...`, completed 2026-10-17 08:37 Taipei.
Recent [Pages 39113382212](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39113382212)
succeeded by duplicate suppression with deploy skipped; it was not a new publication.
No in-flight native deployment found.

Current full article/Capture/raw/body audit export SHA-256: `79fcc4910d82f8e75bcb538335c69aa3b8b71caec2319bebbc45349295775e79`. Per-article raw hashes and Capture metadata are recoverable from the pinned archive metadata; independently recomputed hashes matched.

### Gate 2 — Passed

[Activation PR #43](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/43)
head `ae923f0cdecc99b0890e60c5724bbd7dbbd43bc2` preserved the three workflow
definitions byte-for-byte under `.github/historical/` and installed the reviewed
production template byte-for-byte. CI and ordinary persistence helper unchanged.
Local format/typecheck/diff checks passed; 11 focused checks, 2 retained historical
checks, 337/337 Node checks (178.329s), 31/31 Chromium checks (51.021s).
Independent Standards and Spec reviewers each reported 0 findings.
[Exact-head CI 39121521827](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39121521827)
passed at 19:08:47 Taipei. The old chain stayed live throughout PR/CI preparation.

### Gate 3 — Passed

Old IDs Capture `381740224`, Render `381740225`, Pages `381887694` were explicitly
disabled. Two full repository snapshots at **19:09:42** and **19:10:02 Taipei**
showed all three `disabled_manually`, zero nonterminal runs across queued,
in_progress, waiting, pending and requested states, no newly created downstream
consumer/rerun, and no unresolved Pages deployment. No cancellation needed. Last
actual publication remained deployment `7132459232`/success. Public reader/search
rechecked successfully at **19:10:03**. Archive HEAD/tree and all checkpoint refs
remained identical to Gate 1, so that freshly verified build remained applicable.

The operating coordination was posted on #36 before stop/drain: no old dispatch,
rerun, re-enable, external archive writer or alternate publisher during cutover.
This is operator coordination, not a claim that Actions concurrency locks human
administrators. No competing writer or late old publication was observed.

### Gate 4 — Passed

PR #43 merged normally at **19:10:33**, main/merge
`e7965ffce081bbd8078e8a1185edb5893700d3b7`, without protection bypass. Snapshot
at **19:10:48** showed new workflow **388375554** active, CI independent, actual
workflow directory containing only `ci.yml` and `update-publish.yml`. New registered
bytes matched the reviewed template; the old IDs became `deleted` after definition
removal and have no current registered trigger path. Their source remains retained.
No late old run/deployment. Archive and historical refs unchanged by merge.
[Main CI 39122175485](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122175485)
was observed separately from Production acceptance.

### Gate 5A — Passed: real manual full-update

[Run 39122218434](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122218434),
workflow/application `e7965ffce081bbd8078e8a1185edb5893700d3b7`, selected archive
`0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`, successful. Real GitHub Blog Capture
ordinary-pushed **C `defab4385586c67a196fe8f383a1eb37f8522c79`**. Offline Render
was unchanged, then separately ordinary-pushed successfully (`Everything up-to-date`),
so **R = C**. The accepted no-change path creates no artificial Render commit;
C is a direct ordinary child of drained HEAD and R is descendant-or-equal to C.

Archive tree `567384606fa5975382c1bc54e38b35ae56b25ff3`, 21 reachable commits.
All 17 original identities/bodies retained, no discovery pruning; only legitimate
Capture changed metadata and two raw snapshots (October 9 weekly / October 13
Gemini announcements). Every raw SHA-256 revalidated. Canonical bodies unchanged;
all historical refs retained. One local comparison ran before mirror fetch finished
and saw the stale baseline; it was repeated after the completed fetch. Only the
correct `defab438...` input was used for the authoritative post-publication check.

Astro/Pagefind completed (17 pages / 1114 words), native upload then deploy succeeded.
Deployment **7153710530**, native status success, [public site](https://tsaohoward.github.io/copilot-changelog-mirror/).
At **19:13:26**, Chromium passed listing/order, all retained routes/title/date/source
links, saved prose, anchors, image/video references, repository-base assets,
`weekly releases` title search, `enterprise-provided` body search and navigation.
External media references were checked with external requests blocked.

### Gate 5B — Passed: persisted-source render-rebuild

[Run 39122396833](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122396833),
same workflow/application, selected archive `defab4385586c67a196fe8f383a1eb37f8522c79`,
successful. Native steps explicitly show Capture and Capture push skipped; offline
Render and its ordinary push succeeded unchanged. No acquisition stage executed.
R remains `defab438...`; full archive HEAD/tree/history, immutable identities,
raw bytes and Capture fields unchanged. Fresh Astro/Pagefind/native upload/deploy
succeeded, deployment **7153740176**, native status success. Same complete public
reader/search check passed at **19:15:17**.

### Gate 5C — Passed: known-good native rollback and latest-version restoration

[Rollback run 39122524338](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122524338)
used workflow `e7965ffce081bbd8078e8a1185edb5893700d3b7`, fixed trusted application
**`9cca716865717a50fa02066b98bfa0e2bbba247b`** and fixed complete-derived archive
**`0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`**, confirmed by actual checkout logs.
Capture, Render and both push steps explicitly skipped. Fresh Astro/Pagefind,
native upload and deployment **7153762546** succeeded. Public reader/search against
the selected known-good inputs passed at **19:17:08 Taipei**. Before/after remote
ref exports were byte-identical; fetched archive HEAD/tree/history stayed
`defab438...` / `567384606fa5975382c1bc54e38b35ae56b25ff3` / 21 commits.
All newer raw data survived. No old artifact or historical evidence expiry gate
was used. This is actually executed hosted rollback evidence.

Because rollback selected an older pair, one required extra
[latest-version republish 39122655130](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122655130)
restored fixed application **`e7965ffce081bbd8078e8a1185edb5893700d3b7`** plus latest
verified complete archive **`defab4385586c67a196fe8f383a1eb37f8522c79`**. All writer
steps again skipped; deployment **7153785521** succeeded. Final public reader/search
passed at **19:19:27**. Final full native inventory **19:19:28** found CI and sole
production workflow active, no nonterminal runs, four successful new native
publications and no late old publication. Repeated Git inspection confirmed all
17 identities/raw hashes, complete bodies, archive ancestry and checkpoint refs.
The initial Capture checkpoint was also actually exported and every mode/blob
verified: 11 files, one reachable initial commit.

Merged activation main CI **39122175485** completed **success at 19:18:29**, exact
merge/application SHA `e7965ffce081bbd8078e8a1185edb5893700d3b7`.

Durable input records: [drained metadata](https://github.com/TsaoHoward/copilot-changelog-mirror/blob/0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11/metadata.json)
and [post-activation metadata](https://github.com/TsaoHoward/copilot-changelog-mirror/blob/defab4385586c67a196fe8f383a1eb37f8522c79/metadata.json)
retain every immutable identity, source URL, canonical field, Capture timestamp and
snapshot SHA-256. The pinned trees retain exact raw/body blob bytes. No historical
ref or reset witness was recreated. No Production failure was injected and no
Production run failed or required a retry; isolated destructive failure proof remains
#35's evidence. No ambiguous native deployment occurred.

### Observed Production costs

A newly fetched old complete successful pipeline is Capture
[38986967477](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38986967477),
Render [38987030881](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38987030881),
Pages [38987096817](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38987096817),
2026-10-17 00:34:06–00:37:19 UTC. Application/definition `81b7df4...`, Capture
output `2a18c3d657f344e6d2f0521d4fb73161d0eadbc2`, Render output `5dc00f3...`,
17 articles, one changed canonical body. Three invocations/four jobs: Capture 46s,
Render 44s, Pages prepare 51s, deploy 34s; job sum **175s**, end-to-end **193s**.
Initial queues 3s/3s/4s, cross-workflow handoffs 1s/1s, prepare-to-deploy gap 4s.
Six explicit installs total 27s, plus one nested locked site-build install confirmed
from executed code (within the 18s build step, no separate timing): seven installs.
Capture/persist 23s, Render/persist 21s, native upload 1s, native deploy action 7s.
Grouped historical stage durations include legacy operational checks; finer
acquisition/push/index splits are unavailable. This newer sample supplements the
original October 16 baseline above without rewriting it.

Both old and new observed runners: `ubuntu-latest`, Ubuntu 24.04.5, image
`20261012.334.1`, Node 22.22.0/npm 10.9.4, Astro 7.3.6/Pagefind 1.5.2, same lock
SHA-256 `7062f8445365011714769409b0b94c574894960773e23ae2aba2c474f514e8dd`,
restored npm cache key
`node-cache-Linux-x64-npm-5bd78caab370a3b3aabc9cf8660d17fa327faaa4870fd509bc288bd278d85309`,
17 articles, `/copilot-changelog-mirror/`, real production inputs. New full/render/
restore application `e7965ff...`; rollback application `9cca716...`; archives listed
above. Cache is the npm download cache, not reuse of installed application modules.
Each new run installed once in archive-build, none in deploy; no nested application
install in native directory build. Setup-node/full tool setup measured 8s.

| New run / mode                           | Archive-build | Deploy job | Job sum | Initial queue / job gap | End-to-end | Install | Capture / push | Render / push       | Build/index |         Upload | Deploy action |
| ---------------------------------------- | ------------: | ---------: | ------: | ----------------------- | ---------: | ------: | -------------- | ------------------- | ----------: | -------------: | ------------: |
| 39122218434 full-update                  |           34s |        11s |     45s | 3s / 4s                 |        53s |      5s | 6s / 1s        | 1s / <1s resolution |          4s | <1s resolution |            7s |
| 39122396833 render-rebuild               |           22s |        10s |     32s | 5s / 5s                 |        42s |      5s | skipped        | 1s / <1s resolution |          3s |             1s |            6s |
| 39122524338 known-good republish         |           25s |         9s |     34s | 3s / 3s                 |        41s |      4s | skipped        | skipped             |          3s |             1s |            6s |
| 39122655130 latest restoration republish |           28s |        11s |     39s | 4s / 4s                 |        47s |      4s | skipped        | skipped             |          3s |             2s |            6s |

All values are native timestamp measurements at one-second endpoint resolution;
zero difference means below that resolution, not zero work. End-to-end is creation
to final run update. Build/index includes adapter/Astro/Pagefind; no finer new
Production command JSON timing is claimed. New full-update start/end UTC:
11:11:13–11:12:06; render 11:13:57–11:14:39; rollback 11:15:48–11:16:29; restore
11:17:45–11:18:32. Four successful workflow invocations / eight jobs / four installs /
four native publications; **150s total job intervals**, **183s sum of individual
pipeline intervals**. No failed/repeated Production attempt. Restoration is one
additional publication beyond the three required modes and is included in totals.
Local audit builds, browser checks and routine PR/main CI are separate evidence
and excluded from these Production totals.

Observed full-update sample is 45s job sum / 53s end-to-end versus newer old
175s / 193s, and original old 222s / 244s. The new full Render was unchanged while
the compared old Render changed one body; applications/operational checks and
acquisition/network/cache conditions differ. These are single observed samples,
not a controlled benchmark, monetary billing estimate or generalized savings claim.
The install-count reduction was actually observed; exact future runtime savings
remain unmeasured.

### Actual schedules and current acceptance

As of 2026-10-18 **19:20 Asia/Taipei**, querying actual `schedule` events for workflow
388375554 returned none. Both configured slots are **Pending**, not failed or passed.
Activation occurred after today's two nominal times. Next observation opportunities:

| Slot  | Next nominal Taipei | Nominal UTC      | Actual event / job / deploy / public result |
| ----- | ------------------- | ---------------- | ------------------------------------------- |
| 06:17 | 2026-10-19 06:17    | 2026-10-18 22:17 | Pending; no event observed                  |
| 12:17 | 2026-10-19 12:17    | 2026-10-19 04:17 | Pending; no event observed                  |

Retain actual event creation, job start/queue/execution, selected application/archive,
C/R, deployment and public checks when observed. Investigate the historical nominal
discrepancy using actual event/platform diagnostics; slot arithmetic alone cannot
attribute a delayed event. Cron/timezone remain unchanged; no manual result fills
these rows. Missing observation, platform delay and failure remain distinct.

| Required decision / observation                                          | Current state                      |
| ------------------------------------------------------------------------ | ---------------------------------- |
| #35 functional acceptance and separate explicit activation authorization | Passed, separately recorded        |
| Current schema/raw/identity audit and actual checkpoint restore          | Passed                             |
| Compatible known-good native rebuild/index and rollback inputs           | Passed                             |
| Old disable/drain, sole current production path, no late old deploy      | Passed                             |
| Activation exact-head PR CI and merged-main CI                           | Passed                             |
| Full-update, separate C/R pushes, finished build/native publication      | Passed; R no-change push confirmed |
| Retained data/identities/checkpoints/history                             | Passed                             |
| Persisted-source render-rebuild without Capture                          | Passed                             |
| Known-good saved-derived native republish/rollback                       | Passed                             |
| Latest verified public publication restored; public reader/search        | Passed                             |
| Production costs with conditions and extra publication                   | Passed, bounded observed samples   |
| Actual 06:17 and 12:17 scheduled events/public outcomes                  | Pending, both                      |
| #36 fully accepted / closed                                              | Pending; remains Open              |

Next required work is observing both actual scheduled events and their public
outcomes, then recording dated evidence before deciding #36 completion. #24 remains
independent and unchanged; #37 has not started. No additional evidence protocol,
scheduler or recovery framework was introduced.

## 2026-10-19 final acceptance (Asia/Taipei)

[#36's final accepted record](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6264851670)
closed the cutover issue as completed. This supersedes the earlier dated Pending
schedule/closure rows, without changing their historical observations.

- Actual native `schedule` events [39179692637](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39179692637) at 08:11:58 Taipei and [39233149746](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39233149746) at 17:51:13 Taipei both completed Capture → confirmed ordinary push → offline Render/no-change push → Astro/Pagefind → native Pages.
- Accepted archive: `55d5cd933dca78107957f254dea52d9c0bced333`, an ordinary descendant retaining 17 identities. The user exported this saved revision and ran `production-site.browser.ts` against the public repository base: 1/1 passed in 10.32s, at 18:11:46.702 Taipei. Listing/date/routes/attribution, representative anchors/media/assets, executed title/body search (`weekly releases`, `enterprise-provided`) and navigation passed. External media was blocked and checked as references only.
- The public check used local Node 24.15.0 despite the declared Node 22.22.x range. Locked install warned `EBADENGINE` and the Chromium check passed; this is not a Node 22 environment observation.
- Sole production workflow `388375554`, all three manual modes, native known-good rollback and latest-publication restoration were accepted with retained archive/checkpoints/history. PR #43/#44 and relevant CI passed. The #37 stability/rollback prerequisite is satisfied; no additional production dispatch was needed.

Observed schedule execution substantially lagged configured 06:17/12:17 nominal
slots. Native records do not independently associate each run with its exact
nominal slot or establish the root cause. This accepted limitation requires
separate scheduler review, rather than a punctuality claim or a cron/timezone
change. #24 remains untouched. #37 still owns its cleanup/caller/test audit.
