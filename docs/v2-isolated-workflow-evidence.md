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
  upstream failure and public browser acceptance: pending functional acceptance.
- Real isolated scheduled event: pending observation.
- Production activation and schedule: out of scope (#36).

## Cost conditions

Local environment: Linux/WSL, Node 22.22.0, npm 10.9.4, existing locked dependencies
and Chromium cache. Focused tests run with the existing install; no cold network
or cold browser setup is claimed. Hosted installs and queue/job/pipeline durations
will be recorded from native logs and timestamps, separately from local timing.
No benchmark framework or total CI savings claim is introduced.

## Review and hosted provisioning boundary

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

Approval scope needed to continue: create the public
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
