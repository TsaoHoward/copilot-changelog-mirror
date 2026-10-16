# Issue #35 integration evidence

Implementation based on `f22eb6dc1ea0014f6398e80c31e2157d0f4fc533` and the
[authoritative specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/35#issuecomment-6168543931).
Production remains inactive for this path. #24 and #36 acceptance are separate.

Local contract/Git observations, actual hosted results, public browsing and costs
are recorded below after verification. A local shell schedule test is not an
observed scheduled Actions event. An awaiting isolated schedule is separately
pending and does not turn otherwise completed functional acceptance into a pass
for scheduling.

## Acceptance status

- Routine workflow contracts and real-Git persistence: **passed** locally.
- Native full-update, render-rebuild, explicit known-good republish, representative
  upstream failure and public browser acceptance: **passed** in the isolated target
  on 2026-10-16. The deliberately failed Render run established its expected
  failure boundary; its native conclusion remains `failure`.
- No production acceptance or activation is implied by these isolated results.
- Real isolated scheduled event: pending observation.
- Production activation and schedule: out of scope (#36).

## Cost conditions

Local environment: Linux/WSL, Node 22.22.0, npm 10.9.4, existing locked dependencies
and Chromium cache. Focused tests run with the existing install; no cold network
or cold browser setup is claimed. Hosted installs and queue/job/pipeline durations
are recorded in the hosted section below, separately from local timing.
No benchmark framework or total CI savings claim is introduced.

## Initial review and provisioning boundary (historical)

This section preserves the earlier pre-authorization state. The user explicitly
approved the fixed public isolated target on 2026-10-16; the completed hosted
observations below supersede its pending statuses.

The required `/code-review` ran separate Standards and Spec reviewers against
`f22eb6dc1ea0014f6398e80c31e2157d0f4fc533...3cd1970`.

### Standards

No hard documented violations or actionable baseline smells. The small test
wrappers serve different assertions; another abstraction was not warranted.
The reviewed stages push separately, no-change still pushes, refusal/uncertainty
halts downstream, republish skips persistence, and production remains isolated.

### Spec

Zero code findings and no scope creep. The reviewer confirmed native success
gates, pinned/disjoint checkouts, ordinary pushes, modes, concurrency and
permissions. Required hosted mode/failure/public/cost evidence is a disclosed
pending acceptance gap; actual isolated scheduling is independently pending.

Follow-up polish explicitly records stage input SHA before CLI execution (also
on failure), verifies the selected npm command mappings exist, requires an exact
isolated remote URL, and reports the blocked/pending native deployment gate.

A disposable local export was prepared at `/tmp/issue-35-hosted`, excluding every
production workflow before installing the reviewed template. Separate blank
archive and two-fixture source repositories were prepared. **No remote repository,
branch, environment, schedule or Pages configuration was created.** Automatic
approval review rejected provisioning the new public target and enabling Pages
because public export and external mutations require explicit user approval.
Required full-update/render-rebuild/known-good republish/representative failure,
public browsing/search and hosted cost observations remain **pending functional
acceptance**, not passed. Schedule registration and scheduled execution have not
occurred and remain **pending observation**. This differs from a schedule that is
registered and merely awaiting its nominal time.

Approval scope that was awaiting authorization at that time: create the public
`TsaoHoward/copilot-changelog-isolated-35` repository containing the reviewed
application export and authentic minimized fixture sources; create its isolated
archive/source branches and `github-pages` environment; enable its Actions Pages
site; execute the bounded hosted acceptance and reversible fixture/renderer
failure-and-repair steps described in the runbook. Production remains outside
this scope.

## Final local verification

On source revision `39c34d8`, the complete serial suite passed **334/334** tests
and the serial Chromium suites passed **31/31** checks, with zero failures or
skips. Formatting, type checking, shell syntax and `git diff --check` passed.
Both review axes also reviewed the `3cd1970...39c34d8` follow-up and reported zero
findings. Production workflow files have no diff against the starting `main`.
No original-repository remote branch, issue, archive or Pages setting was changed.

The new permanent coverage is eight tests: three YAML/entry-shell contracts and
five persistence/republish cases. The existing late-Render-failure/offline-repair
case now directly executes the same persistence script used by Actions. Real
compiler/indexer failures and incomplete canonical rejection stay at their
existing #34 seam; the new caller test additionally proves remote R survives an
actual site CLI output-safety refusal. This is composite local evidence, not a
claim of a hosted compiler/indexer failure.

Commands for the accepted local measurements (one invocation each, sequential):

```sh
node --import tsx --test --test-concurrency=1 tests/v2/*.test.ts
node --import tsx --test --test-concurrency=1 \
  tests/v2/search.browser.ts tests/v2/native-site.browser.ts
```

| Local check                         | Result     | `/usr/bin/time` elapsed seconds | Node test-runner reported seconds |
| ----------------------------------- | ---------- | ------------------------------: | --------------------------------: |
| Full retained and replacement suite | 334 passed |                          265.56 |                           286.673 |
| Both Chromium suites                | 31 passed  |                           35.88 |                            37.993 |

The two timing sources returned different durations; both readings are preserved
without interpreting the difference as a performance improvement. Each row is a
single sample, not a median or range. Focused development runs, including the
expected red missing-script/template tests and the corrected missing event-env
fixture, are excluded from these accepted samples. The final focused eight-test
run passed in 6.096 Node-reported seconds with both test files running under the
default test-file concurrency; it is not directly comparable to the serial suite.

Environment: Linux `6.6.87.2-microsoft-standard-WSL2`, Node 22.22.0, npm 10.9.4,
lockfile and dependency versions retained from the starting application, existing
`node_modules` and Chromium cache (Playwright 1.63.0). There was no fresh npm or
browser installation for these samples, so cold installation/download cost is
unmeasured. Full tests and browser suites ran serially at file concurrency 1 and
did not overlap each other. Fixture construction and Git/subprocess setup are
included in suite durations rather than separately benchmarked. All outputs and
remotes are disposable. The new republish case uses one synthetic saved article
at `/isolated/`; the existing suites retain their established authentic and
synthetic corpora and base paths. See the #33/#34 test records for those fixtures'
source/condition/independent-expectation policy. No generalized benchmarking
framework, target count, total CI speedup or hosted performance is claimed.

Hosted setup/install/cache, application/archive revisions, corpus/base, native
stage/upload/deploy/job/queue/pipeline timings and invocation counts are all
**unmeasured pending the approved hosted milestone**. They must be recorded from
actual native runs when access is authorized, alongside mode skips, remote
ancestry, public URLs and title/body search/result navigation. No local result
substitutes for those observations.

## CI checkout portability repair — 2026-10-16

[PR #40's initial CI](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38717498644)
failed 1 of 334 Node tests. Its checkout fetched only the shallow PR merge ref;
the entry-shell test incorrectly assumed the application checkout had
`origin/main`. The error occurred at test setup (`git rev-parse origin/main`),
before the actual workflow entry shell ran. Earlier local success did not prove
portability to CI's ref layout.

The test now creates a minimal temporary application repository and local bare
remote, prepares `main`/`origin/main` with two compatible trusted commits, and
creates a further commit outside that trusted history. Git transport is limited
to `file`. The shipped entry shell runs unchanged in this fixture. Assertions
verify exact mode/application selection for schedule, manual modes and an explicit
trusted ancestor, and reject incorrect repository/default branch/event/mode,
invalid or missing SHA, and existing untrusted application/workflow SHAs before
outputs or success summaries are written. Each invocation starts with empty
output/summary files so preceding successes cannot mask a refusal.

The original focused test reproduced the CI error in a disposable local
single-branch shallow clone with no `origin/main`. The repaired test passed in
that same clone without fetching a real remote. Removing only the ancestry guard
in the disposable template made the existing-untrusted-commit case fail, proving
that the new fixture exercises the history boundary. The real workflow template,
production workflows and CI checkout configuration are unchanged; no network
fetch workaround or Actions simulator was added.

Focused verification passed (3/3 file tests, including the formerly failing test).
On repair source commit `bdd0df5e177862fcefd9a21d884813898c04fee2`, the same commands
used by CI passed: **334/334** tests with `npm test` and **31/31** checks with
`npm run test:browser`, with no failures or skips. Node-reported suite durations
were 231.810 and 32.452 seconds respectively; these are local measurements with
existing dependencies/browser cache, not hosted runner observations. Formatting,
TypeScript type checking and `git diff --check` passed. The new remote CI run is
reported on PR #40 separately; these local results do not establish its outcome.

### Standards

0 hard violations and 0 actionable smells against original PR HEAD
`9f1cc4e1701608d193301b38104ca31fb7591d22...bdd0df5`. The diff is limited to the
test and directly related evidence. The minimal file-only fixture owns its
refs/history, resets outputs between cases and adds no testing framework. The
shipped workflow is unchanged; no regression was found.

### Spec

0 actionable findings or scope creep. The fixture satisfies the requested local
remote/trusted-history boundary, exact positive selection, and refusal of invalid
inputs and existing untrusted commits. It preserves the actual ancestry guard
and adds no real-remote CI fetch workaround. Remote CI must still be observed on
the pushed HEAD rather than inferred from local passes.

This repair performs no hosted provisioning, Pages configuration, archive
mutation or public-site deployment. #35 hosted acceptance remains pending;
#36 production cutover and #24 acceptance remain separate.

## Isolated Hosted Acceptance — 2026-10-16

**Functional acceptance: passed. Actual scheduled event: pending observation.**
The user explicitly authorized the public isolated repository, fixture sources,
Pages setup, reversible failure/repair and evidence updates. This supersedes the
historical provisioning block above; no production credentials or archive were
copied. PR #40 remains Draft; #35 is not closed. #36 production cutover and #24
acceptance remain separate.

- Repository: [TsaoHoward/copilot-changelog-isolated-35](https://github.com/TsaoHoward/copilot-changelog-isolated-35).
- Public site: [isolated Pages](https://tsaohoward.github.io/copilot-changelog-isolated-35/).
- Reviewed export: PR #40 `b71d5b8c76d73419d8d71089727a48fa2da43001`, whose
  [CI passed](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/38824134292).
- Before the first push, all original `.github/workflows` were excluded. Only the
  reviewed template was installed as `.github/workflows/update-publish.yml`.
  Native workflow id `386240409` is active; its installed bytes match the template
  SHA-256 `e85eac85d7e385a38d440aee9e82e23a7537e7c496e7bb678ede50b3af42c03e`.
- Independent empty archive history; no production commits imported. Dedicated
  `acceptance-source` holds test RSS/HTML only. GitHub default branch is `main`.
- Pages `build_type=workflow`, public HTTPS URL above; `github-pages` environment
  has custom branch policy allowing only `main`. Repository Actions are enabled,
  workflow defaults remain `read`, PR approval permission is false. The reviewed
  archive/build job requests contents-write; only deploy requests Pages/OIDC.
  Actual native pushes and publication demonstrate those scoped permissions.
- The active workflow has no production `workflow_run` consumers, production
  repository override, copied credentials or production site/base. The original
  PR receives documentation only from this hosted exercise.

### Revisions used and observed

These aliases are human reading aids, not a protocol required by future runs.
All commits below are in the isolated repository except the reviewed export SHA.

| Alias   | Full SHA                                   | Meaning                                                              |
| ------- | ------------------------------------------ | -------------------------------------------------------------------- |
| App0    | `8f4aae37d74268321a0edbcb34b8de546e6b1559` | Initial reviewed application/workflow export                         |
| App1    | `da369324b3347f3d1ac943b14b70c23a55a1279c` | Isolated fixture renderer repair and offline acquisition guard       |
| I0      | `b1722f658f830ebe1cd762c969cb15a952da0b63` | Independent empty archive root                                       |
| C_A     | `88f1d4cecd137cb68461e0fb95174522f2977ef6` | First successfully pushed Capture, two raw articles                  |
| R_A     | `7b71362ebafb9aeaccb39ee7dded171cad36b38b` | Separately pushed Render, two complete derived articles              |
| C_B     | `e36e2ad0f84b0ce0b27c5f6d94722054d29db7f0` | Pushed Capture before deliberately failed Render, three raw articles |
| R_C     | `7560149179043cfd0fdf507ce7292009aa685d88` | Offline repair Render descending directly from C_B                   |
| Source0 | `7be47d7ca3ece0921706eb60c98fe9efed0ef6b8` | Initial minimized authentic sources/RSS                              |
| Source1 | `bf7cf93cbb9fc602a88d6e23cc310ca68265e8f6` | Adds labeled synthetic unsupported-layout source                     |

The unchanged authentic extracts are `weekly-skills.html` and
`feedback-video.html`, with the existing source/condition/independent-expectation
README preserved. Their captured URL is the isolated raw GitHub URL, not an
assertion of a new production GitHub Blog observation. Their byte hashes are
`1ec52d0b3f10c4e7984e51a288c25d7a316f468d77d13c856a79a8fd871f1a3e`
and `68f6656cd7403b3ffbbe0c20931df76336097ceeee3f461733f62869889f5c47`.
The synthetic `z-unsupported.html` uses `main.acceptance-new-layout`, H1
“Isolated saved-source recovery”, and the independent body sentinel
`durablerecoverytoken saved before offline repair.` Its hash is
`82060fcf0be2bbcbe2d6534ebc73a8e59bc4230bb2ec41f88f841d65adbdc880`.
The normal fixed feed URL was checked for the new RSS before the failure run;
raw GitHub returned an older `max-age=300` response during setup, so dispatch
waited for the actual condition rather than treating stale bytes as the failure.

### Actual native runs

Every row is a real `workflow_dispatch` from the isolated default branch.
The archive input column is the selected saved SHA, not an inferred historical
Capture/Render identity. Skipped stages have no new C/R output.

| Run                                                                                                            | Workflow / application | Saved archive input                          | Capture / Render observation                                                           | Build, upload, deploy                                      | Native result / acceptance                         |
| -------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| [A: full-update](https://github.com/TsaoHoward/copilot-changelog-isolated-35/actions/runs/38842740011)         | App0 / App0            | I0                                           | push C_A, then separately push R_A; two articles                                       | actual Astro + Pagefind (2 pages), native artifact + Pages | `success`; passed                                  |
| [A2: extra full-update](https://github.com/TsaoHoward/copilot-changelog-isolated-35/actions/runs/38843169963)  | App0 / App0            | R_A                                          | both stages unchanged; both ordinary pushes say `Everything up-to-date`; no new commit | fresh build/index (2), upload/deploy                       | `success`; supplemental no-change observation      |
| [B: full-update failure](https://github.com/TsaoHoward/copilot-changelog-isolated-35/actions/runs/38843715754) | App0 / App0            | R_A                                          | push C_B; Render attempts and fails; no R push                                         | build/upload/deploy skipped, zero artifact                 | `failure` as deliberately induced; boundary passed |
| [C: render-rebuild](https://github.com/TsaoHoward/copilot-changelog-isolated-35/actions/runs/38843894190)      | App1 / App1            | C_B                                          | Capture/push skipped; offline Render pushes R_C; three articles                        | actual Astro + Pagefind (3), upload/deploy                 | `success`; recovery passed                         |
| [D: explicit republish](https://github.com/TsaoHoward/copilot-changelog-isolated-35/actions/runs/38844090415)  | App1 / explicit App0   | explicit R_A, while archive branch stays R_C | Capture, Render and both pushes skipped                                                | fresh Astro + Pagefind (2), upload/deploy                  | `success`; read-only known-good recovery passed    |

A2 was an operator sequencing mistake: a dispatch was issued before the failure
source had been committed while correcting the temporary public-check script.
It is included in the invocation count and cost; it is not presented as a required
failure test or hidden from the record. The script initially assumed a body query
returned only one Pagefind link (it also returns a valid section subresult), then
assumed Astro CSS was always an external `_astro` file (small CSS is inlined).
Those check assumptions were corrected to target the article route exactly and
accept valid inline styles. No product/workflow success condition was relaxed.
There were three initial public-check attempts (two harness failures, one pass),
then one passing public check each for B, C and D: six browser invocations total.

### Persistence, failure and recovery proof

A's remote history is `I0 → C_A → R_A`; `R_A^ == C_A` was inspected from fetched
ordinary Git objects. C_A has two null canonical records and exact fixture HTML;
R_A separately adds complete canonical records/bodies, preserving Capture fields.
Native steps show Capture push completes before Render and Render push before
build. Actual Astro compilation and Pagefind indexing complete before upload;
native deployment consumes the artifact from that same run.

B's remote history adds only C_B, whose parent is R_A. The three snapshot blobs
match the authentic/synthetic source bytes. Both older records retain their
complete canonical data; the new record remains null canonical. Native Render
fails with `Unsupported editorial layout: no recognized article body` for
`z-unsupported-cb0b7ee387c3`. Render push, build, upload and the deploy job are
skipped. The native artifact list for B is empty. Before repairing anything,
public listing and both article HTML hashes matched the preceding publication;
public title/body search and navigation also passed. This is an observed retained
site before any deploy invocation, not an assumption about failed deployments.

C's `R_C^ == C_B`. The snapshot tree is unchanged across that boundary
(`dd957e9e247ad7ab34bb2ed6cd7dd923b023f6e4`), as are all capture observations.
The new canonical title/body match the independent synthetic expectation; older
derived content is preserved. Native Capture steps are skipped. The selected
isolated application preloads the existing acquisition blocker, checks its
attempt log on process exit, and writes `Isolated acceptance: zero attempted
source acquisition` to stderr. C's actual log contains that marker. The guard's
caught-fetch positive control failed locally, while the actual npm Render with
`--archive-dir` passed local preflight. This supports zero attempts through the
existing guard's covered interfaces, not a claim of complete OS network isolation.
No source recapture or source HTTP request is required for this repair.

The fixture-specific selector and acceptance preload remain **only** in isolated
App1. They were reviewed on both axes with zero findings. Local preflight caught
an initial isolated npm shell-chain argv error; a forward commit changed it to a
single Node command with a preload so appended CLI arguments reach Render.
That intermediate command was never selected by a hosted run. This was an
acceptance-helper correction, not a defect in the reviewed workflow; no renderer,
package script, guard or workflow change is being copied into the production PR.

D explicitly selected App0 and R_A from trusted history, while its workflow ran
at App1. All three branch refs, complete archive ancestry and archive tree entries
were compared before/after and were identical; the remote archive head remains
R_C. The selected saved metadata/bodies contain two complete articles. New build
and indexing logs report two pages; a newly uploaded artifact is consumed by
native Pages. Existing artifacts were neither downloaded by our caller nor
renewed/deleted. Fresh Git inputs, build/upload and deployment suffice without
historical artifact/proof retention. No archive rewind or conflict repair occurs.

| Publication run | Native `isolated-pages` artifact ID | Created UTC         |  Bytes |
| --------------- | ----------------------------------: | ------------------- | -----: |
| A               |                         12020824997 | 2026-10-16 02:54:01 | 273118 |
| A2              |                         12022151535 | 2026-10-16 02:59:06 | 273119 |
| C               |                         12022711007 | 2026-10-16 03:07:29 | 273635 |
| D               |                         12022921302 | 2026-10-16 03:09:48 | 273128 |

All invoked deployments returned success and the actual public URL was checked.
No native deployment failure/status uncertainty occurred or was artificially
induced; its inspection/recovery procedure remains in the runbook. No old-byte
preservation guarantee is inferred for a failed deployment response.

### Public reader observations

Real Chromium visited the actual Pages URL with a fresh browser context per
invocation. At 10:59:28, 11:06:32, 11:09:02 and 11:11:26 Asia/Taipei respectively,
passing checks for A's unchanged publication, B, C and D covered listing counts,
`/copilot-changelog-isolated-35/posts/` routes, article H1/body, source links,
home/back navigation, base-prefixed local assets, image/video URL references,
title search `Sol`, body search `rewinds`, and result navigation. C additionally
found the repaired article and body token. D excluded that token from search and
restored the known-good two-article listing. Each passing check saw zero local
HTTP asset errors. External media fetches were blocked; source URL references
were checked, upstream media availability was not asserted.

A/B/D listing SHA-256 was
`8c3d0c597800a566d55e40d87ddd667c4655404fcb88e2cb32b577b7ffa0f311`;
C's three-article listing was
`265a630ab8334c0ee6e90838981ff83037ae8da2b67d769a5bfb4fa578b64225`.
Both unchanged authentic article HTML hashes matched across A/B/C/D. These are
human observations of served bytes, not a deployment identity or recovery gate.
The primary A content observation occurred after A2's unchanged publication;
remote input/content equality and both native success runs are recorded above.

### Hosted setup and execution costs

Conditions: observed `ubuntu-24.04` hosted runners, application Node 22.22.0,
npm 10.9.4, reviewed lockfile, actual Astro 7.3.6 and locked Pagefind 1.5.2.
A reports `npm cache is not found`; A2/B/C/D report a setup-node npm cache hit.
This identifies the repository cache state, not every runner/network cache.
Each archive/build job invokes `npm ci` once; deploy jobs have no application
checkout/install. Native build/index output is fresh per successful publication.
There is no hosted browser installation: public checks ran from the existing
local Playwright 1.63.0/Chromium cache against the real public server. Each run is
one observation, not a median, performance comparison or promised saving.

The repository was created at 02:52:17 UTC and first dispatch created at 02:53:30:
73 seconds for remote provisioning/branch/environment/source-readiness audit.
This excludes earlier local export preparation and later manual inspection,
fixture-cache waiting and repair preflight, which were not separately timed.

Durations below use native API timestamps with one-second resolution. `0*`
means start/end fell within the same reported second, not zero compute. `—` is
skipped, not a measured zero. Initial wait is first job start minus run creation;
pipeline is final run update minus creation, including queue, handoff and cleanup.

| Run | Initial wait s | Archive/build job s | Deploy job s | Pipeline s |
| --- | -------------: | ------------------: | -----------: | ---------: |
| A   |              6 |                  30 |           12 |         54 |
| A2  |              3 |                  27 |           12 |         47 |
| B   |              4 |                  20 |            — |         24 |
| C   |              4 |                  29 |            9 |         46 |
| D   |              4 |                  28 |            9 |         46 |

| Run | Install s | Capture s |    C push s |    Render s | R push s | Build + index s | Upload s | Native deploy step s |
| --- | --------: | --------: | ----------: | ----------: | -------: | --------------: | -------: | -------------------: |
| A   |         5 |       0\* |           2 |         0\* |        2 |               2 |        2 |                    8 |
| A2  |         4 |         1 |         0\* |           1 |      0\* |               3 |      0\* |                    8 |
| B   |         5 |       0\* | 1 (success) | 1 (failure) |        — |               — |        — |                    — |
| C   |         4 |         — |           — |           1 |        1 |               3 |        1 |                    6 |
| D   |         5 |         — |           — |           — |        — |               3 |        1 |                    6 |

Total invocation allocation: five native workflow runs (including extra A2),
five application installs, three Capture attempts, four Render attempts (one
expected failure), four actual Astro/Pagefind build pairs, four native uploads
and four native deployments. No acquisition/push/compiler/indexer failure matrix
was repeated hosted. These costs are separate from routine CI and #36 production
operation; no total CI or billing saving is claimed.

### Schedule and remaining acceptance boundaries

- YAML configuration on isolated `main`: **passed** — `17 6,12 * * *`,
  `Asia/Taipei`, matching 06:17/12:17 local.
- Native workflow registration: **active** — id `386240409`, correct default-branch
  path and reviewed template bytes. The API exposes workflow state, not a
  separate cron-service registration acknowledgement; scheduler-specific
  registration is not independently proven by manual executions.
- Actual `schedule` event and its run outcome: **pending observation**. The
  observed run list contains only the five manual dispatches. The next nominal
  isolated opportunity after these observations is 2026-10-16 12:17 Asia/Taipei;
  actual GitHub start time is not promised. No synthetic event is counted.
- Per the approved specification, waiting for that event does not block otherwise
  completed isolated functional integration acceptance. Production schedule
  observation/activation belongs to #36; #24 remains separate.
- PR #40 receives only evidence/runbook changes. Its pushed HEAD and actual CI
  outcome are reported on the PR; isolated success is not substituted for CI.
  PR remains Draft and awaits human merge review; no issue is closed here.
