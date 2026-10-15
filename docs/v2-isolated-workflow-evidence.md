# Issue #35 integration evidence

Implementation based on `f22eb6dc1ea0014f6398e80c31e2157d0f4fc533` and the
[authoritative specification](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/35#issuecomment-6168543931).
Production remains inactive for this path. #24 and #36 acceptance are separate.

Local contract/Git observations, actual hosted results, public browsing and costs
are recorded below after verification. A local shell schedule test is not an
observed scheduled Actions event. An awaiting isolated schedule is separately
pending and does not turn otherwise completed functional acceptance into a pass
for scheduling.

## Status before hosted verification

- Routine workflow contracts and real-Git persistence: implementation in progress.
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
