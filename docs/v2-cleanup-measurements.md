# Issue #37 measurement boundaries

The final measurements compare the pre-cleanup default revision
`64516e9d685c2082f9fa67aeccb87d113be7c480` with the issue branch under the same
local Node 22.22.0 / npm 10.9.4, WSL2 Linux x86_64 host, installed Chromium and warm
npm/browser caches. Output/cache directories are fresh per native build; OS page
cache and other interactive host work are uncontrolled. Default Node file-level
test concurrency is unchanged. Samples are observations, not performance gates.

Before: locked offline `npm ci` passed in 4.92s; formatting 2.01s; typecheck 1.85s;
337 contract checks passed in 177.71s and both Chromium suites passed 31 checks in
23.68s. Format/type ran while the browser process was active, so summing these
intervals does not establish a serial end-to-end CI wall time. Final local gates
and invocation counts are recorded after execution below.

Temporary delivery counters observe actual child-process starts/durations and
Git calls; they are outside the repository, do not substitute tools and are not a
new benchmark/orchestration framework. Old workers sanitize their environment,
so nested in-process Pagefind API timings/counts are not fully visible to this
counter; unavailable values remain explicit. Native starts are also observed by
the existing minimal test helper. Summed child/test durations overlap with file
concurrency and must not be presented as wall time or summed hosted job time.

Discarded/setup observations: an initial sandbox locked install failed validating
esbuild's native binary (`EPERM`); the same offline install outside the sandbox
passed. A first temporary counter wrapper lost Node's promisify symbol and made
an instrumented baseline invalid; restoring that symbol produced the 337/337
baseline above. Neither failure is an application regression or accepted timing
sample. Focused development reruns, the first browser date-fixture correction,
and the one-time known-good rollback check are outside final CI measurements.

Hosted before CI: [run 39123540575](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39123540575)
at the exact baseline revision succeeded; exported native jobs/logs supply separate
job/step and pipeline observations. Hosted after CI, if available, is compared in
its own runner/cache/lock context rather than equated with local elapsed times.
A local-only observation cannot establish hosted CI speed or future reliability.

Production observations are reused from accepted #36. The recorded old sample
was 175s summed job time / 193s end-to-end with 7 installs; the new sample was 45s /
53s with 1 install. These were single samples with different Render outcomes and
runner/cache conditions, not universal savings. Both actual 2026-10-19 schedule
successes and their public reader outcome were accepted separately. Cleanup did
not dispatch production. See dated [production evidence](v2-production-evidence.md)
for selected SHAs, job intervals, cache/runner caveats and unresolved scheduling
delay. Earlier #33/#34 measurements/comparisons remain historical context, not a
substitute for the final regular-gate comparison.

## Final local gates

One accepted before and one accepted after sample; no repeated-run distribution,
median or spread is estimated. Node harness elapsed and `/usr/bin/time` wall
readings are both retained below; they differ for the contract run, so they are
not silently treated as interchangeable clocks. After checks were serial. No cold
network install, cold browser download or controlled host-cache experiment was run.

| Group                       | Before                                           | After                                         | Boundary                                                                          |
| --------------------------- | ------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Locked install              | 4.92s                                            | 2.53s                                         | `npm ci --offline`, warm npm cache, one invocation each                           |
| Formatting                  | 2.01s                                            | 1.04s                                         | external wall, includes source/config/docs discovery                              |
| Typecheck                   | 1.85s                                            | 1.47s                                         | external wall                                                                     |
| Contracts                   | 337 pass; harness 177.71s; external wall 161.44s | 71 pass; harness 10.26s; external wall 7.60s  | same `npm test`, default file concurrency; groups 29 → 11                         |
| Browser setup               | unavailable locally                              | 0.45s                                         | one warm `playwright install chromium`; hosted CI additionally uses `--with-deps` |
| Chromium                    | 31 pass; harness 23.68s; external wall 21.02s    | 13 pass; harness 16.79s; external wall 16.86s | old and native suites → one native suite                                          |
| Serial checks after install | unavailable (before groups separately sampled)   | 27.44s                                        | format/type/contracts/warm browser setup/browser together; install separate       |

A formatting-only attempt stopped before any tests because multiline inventory
expressions exposed non-idempotent Markdown formatting. Normalizing those prose
expressions fixed the document; it did not change a test or production behavior.
The final gate measurements above exclude those formatting-only attempts.

| Observed caller boundary           | Before contracts        | Before browser     | After final checks |
| ---------------------------------- | ----------------------- | ------------------ | ------------------ |
| Git API invocations                | 14,138 / 128.08s summed | 281 / 0.89s summed | 732 / 2.83s summed |
| Git `init` calls                   | 441                     | 4                  | 31                 |
| Observable Astro subprocess starts | 14 / 50.40s summed      | 11 / 15.80s summed | 7 / 9.82s summed   |
| Observable Pagefind CLI starts     | 3 / 0.29s summed        | 3 / 0.14s summed   | 6 / 0.24s summed   |

These are process **caller** observations, not kernel-wide process accounting.
Old selected workers replace environment/preloads, so before Astro/Git observations
are lower bounds and old nested Pagefind API counts/times are unavailable. Do not
claim that the before Pagefind total was six, or infer a percentage process saving
from partial counts. Native after counts reconcile: four actual Astro failure/safety
attempts and three browser builds; three safety/failure Pagefind attempts and three
browser indexes. Cheap validation starts neither tool. Git `init` is an observed
invocation count, not a precise fixture-constructor count. Fixture construction
outside these boundaries is not separately timed in this final sample.

The existing primary-browser diagnostics observed setup 2.02s (including offline
Render and primary build), primary adapter 17.11ms / Astro 1411.54ms / Pagefind
54.86ms, and primary browser interactions 7.74s. One primary setup is shared;
changed and empty inputs each execute a necessary real build/index. Browser launch,
changed/empty builds and their interactions account for remaining browser-group
cost. Compiler/indexer process startup and Chromium interactions are remaining
bottlenecks; no numerical speed target gates correctness.

Fixture scale: before, full production HTML+frozen JSON totaled 669,534 bytes for
six authentic sources, in addition to three minimal HTML extracts (10,985 bytes)
and a synthetic gap source. After, full inputs/runners remain recoverable in Git;
three authentic extracts total 11,706 bytes including newly retained actual source
metadata. The primary artifact has 14 articles (3 authentic + 11 synthetic gaps),
changed index has 2, and empty has 0. The one-time known-good rebuild has 17 and is
outside routine CI. No fixture/build count is an acceptance threshold.

Lock context: before SHA-256
`7062f8445365011714769409b0b94c574894960773e23ae2aba2c474f514e8dd`;
after `3425f0c526d247eb6845c031bcd5534f95e63ffec65b77354f79d57f98f0b019`.
Only direct yaml classification moved to devDependencies; package versions and
resolved dependencies were unchanged. Browser library is Playwright 1.63.0, with
the same installed Chromium used on both sides. The local counter overhead and
uncontrolled OS cache apply to both samples; no causal saving or future duration
is guaranteed by the observed group differences.

## Hosted before context

Exact-baseline CI run 39123540575 used ubuntu-24.04 image `20261012.334.1`, Node
22.22.0 and restored npm cache key
`node-cache-Linux-x64-npm-5bd78caab370a3b3aabc9cf8660d17fa327faaa4870fd509bc288bd278d85309`.
It had one job/install/browser setup: install 5s, formatting 4s, typecheck 4s,
contracts 395s, browser setup including OS dependencies 22s, Chromium 43s.
Job interval 11:30:56–11:39:03 UTC = **487s summed job time** (one job);
run creation to final update 11:30:53–11:39:04 = **491s end-to-end**.
These native timestamp intervals include runner/setup/teardown boundaries and
are separate from local test harness durations. One sample has no spread estimate.

### Group attribution and browser environment

Final local Chromium was **153.0.8010.12**, executable from the installed
`chromium-1243` cache, with Playwright 1.63.0. This is the same browser cache used
for baseline and final local suites.

Summing top-level test durations **within** selected files helps locate work; files
run concurrently, so summing across this table does not yield suite wall time:

| Baseline file/group                         | Before summed test time               | Final owner / after observation                                                   |
| ------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Pages coordination (19 top-level cases)     | 177.27s                               | Retired; necessary product checks moved to named active owners                    |
| Stage writer (10 cases)                     | 34.29s                                | Retired; directory/ordinary persistence owns durability                           |
| Full production site (one case, both bases) | 14.58s                                | Historical comparison retained, routine primary/browser owns minimized conditions |
| Directory command contracts                 | 30.95s                                | 9.98s, with duplicate ordinary push conflict moved to production helper tests     |
| Native input/safety/tool failures           | 16.54s                                | 7.51s, including new completed-tools/output failure                               |
| Cheap acquisition/directory contracts       | Not separately attributed here        | 0.145s                                                                            |
| Normalization contracts                     | Prior slice records retained          | 0.073s                                                                            |
| Domain / projection                         | Not separately attributed here        | 0.019s / 0.006s                                                                   |
| Content / metadata normalization            | Prior slice records retained          | 0.059s / 0.023s                                                                   |
| Installed workflow contract / entry shell   | Former isolated and production groups | 0.038s / 0.359s                                                                   |

There is no paired per-file population for retired responsibilities: active owner
conditions have moved, so these rows describe attributed work rather than an
assertion of equivalent per-file functionality or a causal speedup. The complete
case disposition supplies behavioral equivalence at the agreed seams.

### Reused latest scheduled production observation

Accepted native schedule run [39233149746](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39233149746),
application `64516e9d685c2082f9fa67aeccb87d113be7c480`, used a 17-article archive
and completed at 2026-10-19 17:52:02 Taipei. Its native intervals were archive/build
33s and deploy 9s = **42s summed job time**, versus **49s end-to-end** from creation
at 17:51:13. Capture 7s, Capture push 2s, Render 1s, Render no-change push within the
same second, build/index 2s, upload 1s and native deploy 6s. Timestamp resolution is
one second: the no-change push is not a zero-cost claim. One archive/build install,
one build/index and two ordinary confirmed push steps occur; deployment installs
no application dependencies. This is a single accepted **pre-cleanup** production
sample, not an after-cleanup deployment or a repeatability distribution. It reuses
#36 evidence; no new production operation was performed for this ticket.

## Hosted after-CI comparison

The user explicitly authorized opening a draft PR after the earlier automatic
publication review rejection. The reviewed branch was pushed and
[Draft PR #45](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/45) created;
no production workflow was dispatched. Hosted
[CI run 39240052730](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39240052730)
passed at application/review-record revision
`ae1300e0ff8a4f6d285aa494bacac32c3c2b625a`, containing reviewed code `efadbf8`.
All install/format/type/contract/browser steps succeeded. Its logs report 71
contract and 13 Chromium checks passing with no skips.

| Native hosted interval                   | Before: 39123540575 | After: 39240052730 |
| ---------------------------------------- | ------------------- | ------------------ |
| Locked install                           | 5s                  | 6s                 |
| Formatting                               | 4s                  | 1s                 |
| Typecheck                                | 4s                  | 2s                 |
| Contracts                                | 395s                | 17s                |
| Chromium setup including OS dependencies | 22s                 | 22s                |
| Chromium acceptance                      | 43s                 | 18s                |
| Summed job time (one job)                | 487s                | 77s                |
| End-to-end creation → final update       | 491s                | 81s                |

After native job interval: `2026-10-19T10:48:16Z` → `2026-10-19T10:49:33Z`;
run interval: `2026-10-19T10:48:13Z` → `2026-10-19T10:49:34Z`. Each workflow has one
application dependency install, one contract command, one browser setup and one
browser acceptance command. Both use the pinned Node 22.22.0 runtime and the same
package versions; the after lock differs only by direct yaml dependency placement.
Local process-counter visibility limitations above still apply; native logs do not
supply a kernel-wide Git/build/index process census.

Runner image: ubuntu-24.04 `20261012.334.1`, provisioner `20261012.601`, matching the baseline image. Node was 22.22.0 and npm 10.9.4. Hosted Chromium downloaded Chrome for Testing/headless shell 153.0.8010.12 (Playwright revision 1243), matching the local browser version.

Cache log observations: the after npm cache was **not found**, while the baseline restored its recorded key. The after run saved the new lock-derived cache on completion. This difference applies to install/whole-run comparison; it is not hidden as a matched warm-cache pair.

- `npm cache is not found`
- `Cache saved with the key: node-cache-Linux-x64-npm-f61841d7636a3adcf49fcc8f0dfa843b78b9574dfff30db7fffae5fe720a396b`

Before was a default-branch push; after was a draft-PR check at the recorded
revision. This is one sample on each side, with GitHub-hosted runner/cache/network
variation and changed fixture/caller scope. No paired repetition spread, causal
percentage speedup, punctuality or future CI duration is claimed. The observed
native group/job/pipeline intervals are comparable observations with these limits,
separate from local clocks and reused pre-cleanup production samples. The after
sample addresses final hosted-gate observation without a production deployment.

Subsequent delivery-record commits update documentation only; their CI is checked
separately, rather than relabeling this observed sample as a different revision.
