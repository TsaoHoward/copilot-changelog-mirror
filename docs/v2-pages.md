# v2 Pages publication and recovery

The production Node Pages workflow consumes the v2 archive and presentation-owned deployment identity. `.github/workflows/v2-pages.yml` follows `V2 production render` on the `mirror-data-v2` target. All stages share `copilot-archive-production`, `cancel-in-progress: false`, and `queue: max`. Completion events start independent runs after the upstream releases the queue; no child wait holds it. [Checkpoint/reset activation](v2-cutover.md) and [hosted acceptance](v2-acceptance.md) remain separately recorded; local tests do not establish a live deployment.

## Two identities and immutable selections

The archive API owns canonical publication identity. Pages validates the complete
joined publication, including empty archives, against the successful render
record. Legacy or incomplete state is rejected without repair.

The presentation API (`site:identity`, `site:build`) owns deployment projection,
normalization, serialization and hashing. Pages never chooses publication/build
fields or hashes workflow bytes itself. The selected definition checkout supplies
`.github/v2-pages-build.json`, an authoritative supported three-phase build
contract. Its runtime setup/runner match the workflow; its normalized locked
install, environment and Astro build settings drive real execution and identity.
Unsupported phases/settings fail. Changing workflow build execution requires
updating this presentation contract and its agreement checks.

Automatic publication inherits the exact render application's revision. Manual
publication selects the trusted publication run's default-branch application
revision, allowing presentation fixes against an unchanged rendered archive.
Both use their recorded publication workflow-definition revision. Render
application/definition provenance remains in `render_record`; publication
selections are separate. Committed source and the exact rendered archive are
exported into invocation-owned temporary directories. No moving archive tip is
substituted. Dependencies are installed from the selected lockfile before the
acquisition-blocked real Astro build; dependency installation and operational
Git/Actions traffic are distinct from feed/article/media acquisition.

## Command boundary

Use `npm run pages -- <operation>`. Commands emit one JSON object, diagnostics on
stderr and nonzero failure; `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY` are supported.
Options common to every operation:

```sh
--repo APPLICATION_REPOSITORY --definition-repo CONTROL_REPOSITORY \
--repository OWNER/REPO --branch main --archive-branch mirror-data-v2 \
--state INVOCATION_OWNED/pages.json --run-id RUN_ID --attempt ATTEMPT
```

Hosted execution derives the exact current run/attempt from Actions environment
and checks event/server/default-branch/definition agreement. Local invocations
still require server-backed exact attempts; there is no unverified local-deploy
mode. The production command protects the legacy `mirror-data` target.

Operations, in order:

1. `select`: use `--render-run ID --render-attempt ATTEMPT` together, or omit both
   for manual resolution of current verified rendered state. Automatic mode
   consumes the exact completion event; a successful non-advancing render produces
   `stage-only`. Manual successful render-only evidence is usable, including an
   earlier successful attempt followed by a failed rerun. No usable current
   evidence requires render-only renewal, never publication from a SHA alone.
   Optional `--base /PATH/`, `--site https://HOST` and
   `--definition-file .github/v2-pages-build.json` select supported build inputs.
   `--force` defaults false. `--reestablish` is separate explicit manual recovery.
2. `prepare --output FRESH_DIRECTORY`: revalidate exact freshness and baseline,
   execute the selected locked install and actual staged Astro build. Output must
   be outside source checkouts. The local acceptance fixture's `--installed`
   option reuses preinstalled dependencies only after the presentation API verifies
   the selected lockfile; it is not used in workflow execution.
3. Upload output as `v2-pages-build-RUN-PREPARATION_ATTEMPT`, then
   `bind --artifact-id ID`: verify server ownership and successful build/upload
   steps; record the exact artifact association. Upload the resulting `pages.json`
   as `v2-pages-preparation-RUN-PREPARATION_ATTEMPT`.
4. `authorize --preparation-run ID --preparation-attempt ATTEMPT`: load that exact
   successful preparation from Actions, reverify render evidence, artifact
   ownership/availability, current baseline and remote freshness immediately before
   the hosted deployment boundary. A deployment-only retry retains original
   preparation, definition and artifact while recording the new deployment attempt.
   It neither rebuilds nor recalculates identity from new sources.
5. Use the selected artifact name with the hosted Pages action, then
   `report --url https://HOST/PATH/ [--job-id ID]`: associate the successful exact
   deployment job/step and completion time with the result. Omitted job ID is
   resolved from the exact attempt's jobs. Upload as
   `v2-pages-result-RUN-DEPLOYMENT_ATTEMPT`. `report` without success options
   reports the current outcome; `PAGES_STATUS=failure|cancelled` marks failure.

The workflow automatically supplies these operations and attempt-specific names.
Acquisition/render options and partial selectors are rejected. Durable evidence
uses a separately validated `version: 2, kind: pages` schema; capture/render
records and legacy fingerprints are not reinterpreted. Outcomes distinguish
`pending`, `built`, `prepared`, `authorized`, `deployed`, `duplicate`, `stage-only`,
`superseded` and `failure`. A local build or upload is never a deployment claim.

## Baseline and freshness

The latest actual successful compatible deployment is selected by server-backed
successful deployment-step completion time across paginated run **and exact
attempt** history. A later retry of an older run can be the latest deployment.
Failed/pending/cancelled jobs and duplicate/skipped deployments do not replace it.
Verification requires the trusted successful completed run, job, deployment and
reporting/evidence steps, matching immutable preparation, artifact ID/name,
versioned identities, URL and completion time. No older-success fallback is used
when the selected candidate is contradictory, unavailable or expired. API errors
are failures, not absence. Genuine absence permits first adoption.

An equal identity yields `duplicate` before building/uploading. Comparison is
repeated at preparation and immediately before deployment/retry. Force bypasses
only equality, including that final duplicate check. It does not bypass trust,
canonical validation, supported build contracts, baseline verification, artifact
availability, build/report failure or freshness.

Freshness is checked after queue acquisition, before preparation/build and at the
final hosted deployment boundary. A different remote archive SHA yields explicit
`superseded`, including with force or retention recovery; Git/API lookup errors
fail. Publication never pushes, commits or updates archive/application refs or
changes user HEAD/index/work. Evidence lives outside metadata, snapshots and
Markdown. Generated output includes listing, articles, assets and static search,
not raw archive evidence. Only the production deployment job has Pages/OIDC write;
builds have contents/Actions read.

## Retention and operator decision tree

Stage, preparation and deployment-result evidence request **90 days**, subject to
repository policy/deletion. Uploaded Pages build artifacts explicitly request
**1 day**. They serve different purposes: routine successful baseline comparison
uses result/preparation proof and the recorded exact build artifact association;
it does not download historical build bytes or require them to survive forever.
Git content can outlive Actions evidence, but Git state alone is not handoff proof.

| Situation                                                                                                   | Operator action                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed deployment; original preparation/build artifact still available                                      | Retry the failed deployment job with original preparation attempt and artifact.                                                                                                        |
| Failed deployment; Pages build artifact or preparation expired                                              | Start fresh manual publish-only to rebuild current verified render input.                                                                                                              |
| Successful render evidence expired/unavailable                                                              | Renew via render-only first; then publish-only. No recapture is needed.                                                                                                                |
| Latest identifiable successful deployment baseline evidence explicitly expired                              | Ordinary publish-only and force fail with `baseline-evidence-unavailable`. Select manual `reestablish` to build/upload/deploy current verified content and create a new exact success. |
| Missing unexpected proof, malformed/contradictory evidence, uncertain ordering, API/auth/rate-limit failure | Investigate/repair. Re-establishment cannot bypass these failures.                                                                                                                     |

Re-establishment requires positively established artifact expiry on the exact
identifiable successful candidate. It records the old candidate, reason and
operator mode, and still requires current trusted render evidence, supported
selected inputs, real build/upload, fresh archive and completed trusted deployment
and reporting. Failed recovery does not establish a new baseline. Once the new
success is verified, identical subsequent requests are ordinary duplicates.

Build/upload/deployment/result-upload/final-report failures fail the attempt. Even
if the Pages boundary succeeded, incomplete reporting cannot become a verified
baseline. Inspect Actions summaries and links to exact render/preparation/
deployment attempts, then use the decision tree above.

## Verification

`tests/v2/pages.test.ts` executes the real Node boundary in temporary Git
repositories/local bare remotes with real staging/Astro/search output. Only hosted
Actions evidence/artifact transport and the hosted Pages deployment boundary are
fixtures. It exercises raw-only evidence churn, identity equality, presentation
changes, exact attempts/retries, deployment ordering, trust/artifact failures,
retention recovery, preservation and acquisition rejection. Presentation's
existing identity matrix remains authoritative for individual canonical and
build-input sensitivity. Workflow checks inspect the queue, permissions, exact
attempt/artifact wiring, retention, build-contract agreement and production
wiring. Run `npm run typecheck`, `npm run format:check`, and `npm test`.
