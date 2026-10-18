# Issue #36 production preparation and observation

**Preparation complete; activation and production acceptance pending.** Authority:
[#36 body and specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6214593750),
parent #32, prerequisite #35. This record does not close #24. No production
workflow was disabled/enabled/dispatched, no archive ref changed, and no new
Pages deployment was requested by this implementation.

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
