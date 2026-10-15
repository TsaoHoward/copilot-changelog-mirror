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
