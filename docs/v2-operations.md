# Durable v2 capture and render

`npm run stage --` is the Node operational boundary. It uses the selected application's capture/render CLI and shared archive-domain APIs. It owns exact input preparation, ordinary remote pushes, remote freshness, Actions evidence validation and reporting. Execution evidence never enters `metadata.json`, snapshots or canonical bodies. Canonical publication identity comes from the render domain; this command does not define deployment identity or make a Pages decision.

## Production operation

The v2 capture/render/Pages chain shares the `mirror-data-v2` archive and `copilot-archive-production` queue (`cancel-in-progress: false`, `queue: max`). Capture alone owns the schedule at 06:17/12:17 Asia/Taipei. [Checkpoint and activation](v2-cutover.md) precede fresh bootstrap; production writers verify the frozen v1 boundary before mutation. The legacy `mirror-data` target remains protected, and domain validation rejects legacy state on any target.

## Commands

Install the locked Node dependencies with `npm ci` (Node 22.22). For local operations, use a trusted application checkout and the checkout containing the current operational tools:

```sh
npm run stage -- capture --repo /path/to/app --definition-repo /path/to/control \
  --repository owner/repo --branch main --archive-branch mirror-data-v2 \
  --remote origin --state /tmp/stage.json

npm run stage -- render --repo /path/to/app --definition-repo /path/to/control \
  --repository owner/repo --branch main --archive-branch mirror-data-v2 \
  --remote origin --state /tmp/stage.json --advance true
```

`--archive-branch` is mandatory. Repository and default/application branch identify the trust domain, while remote chooses the Git transport. Capture defaults to advancement; `--advance false` persists capture only. Manual render defaults to render-only; `--advance true` produces evidence eligible for the production Pages consumer. Publish-only uses the separate [Pages command](v2-pages.md). Local records default to run ID/attempt 1/1; these local identifiers do not authorize hosted advancement. Hosted records use actual Actions IDs and attempts.

Capture alone accepts `--feed-url` and `--timeout-ms` (fixture `file:` acquisition is supported). Render rejects those options and runs the selected application subprocess with source HTTP(S), fetch and socket acquisition disabled. Attempted acquisition fails even if application code catches it. Operational Git and Actions evidence traffic runs outside that subprocess.

To use an exact capture handoff locally, specify both `--upstream-run ID --upstream-attempt N` on `render`. The application checkout must match the inherited capture application SHA. `verify --upstream-run ID --upstream-attempt N --upstream-stage capture|render` validates evidence without writing the archive. The application and workflow-definition checkout revisions remain separate even when equal.

Actions uses the same executable:

- `select --stage capture|render --repo control --definition-repo control --branch main --archive-branch mirror-data-v2 --state /tmp/stage.json` reads the Actions environment/event, guards the trusted default branch, selects the exact upstream attempt and emits `application` and `proceed` to `GITHUB_OUTPUT`.
- `write --repo app-source --definition-repo control --state /tmp/stage.json` verifies both checkouts, pins persisted input and performs the writer operation.
- `report --state /tmp/stage.json` emits JSON and a readable Actions summary. A failed/cancelled `STAGE_STATUS` removes eligibility and successful output claims, retaining verified persistence for diagnostics.

The command writes only JSON to stdout and diagnostics to stderr; failure exits nonzero. Use `npm run --silent stage -- ...` when piping stdout as JSON. Selection and reporting failures also fail the attempt. State files and workflow outputs are written before stdout advertises success.

## Durability and outcomes

Each invocation prepares its archive and committed application source in temporary Git state; the application's HEAD, index, work and archive refs stay intact. Dirty application work is preserved while the recorded committed source executes. Operational tools require a clean control source checkout; the offline guard is loaded from the committed definition revision. A conflicting user-owned archive branch is refused rather than reset. A fresh manual stage selects the designated remote head; automatic rendering uses only the capture's validated exact output. Only capture may bootstrap absent input. Production bootstrap additionally requires immutable checkpoint/reset-input proof and atomically persists its initial-capture witness with the branch; later state must descend from that witnessed revision.

Freshness is checked after selection/preparation, before the domain writer, before ordinary push, and after persistence. Domain commands validate the full candidate and create at most one archive commit. A local candidate never authorizes a downstream run. Changed results become successful only after the remote contains the exact output. No-change results verify the selected remote revision without a new commit or timestamp churn. Ordinary Git rejections and uncertain transport results are failures; there is no force push, rebase or moving-tip fallback.

| Outcome      | Meaning                                                                | Recovery/advancement                                                      |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `changed`    | Domain changed the archive; output remotely verified                   | Eligible iff advancement requested                                        |
| `no-change`  | Domain retained the selected archive; remote revision verified         | Can renew evidence and recover unfinished downstream work                 |
| `stage-only` | Trusted capture evidence explicitly declined advancement               | No derivation/output; run manual render if desired                        |
| `superseded` | Remote state advanced beyond this exact request                        | No eligible output; follow the newer chain or select a fresh manual stage |
| `failure`    | Acquisition, derivation, Git, validation, reporting or evidence failed | No eligible output; inspect diagnostic and recover independently          |
| `pending`    | Input selected; writer has not succeeded                               | Never a downstream handoff                                                |

Archive outcome and canonical publication comparison are distinct. Render records `publication_input`, `publication_output` (SHA-256) and `publication_outcome`: `initialized` means the prior projection was incomplete, `changed` means comparable canonical projections differ, and `no-change` means they match. Raw chrome or unused discovery changes can produce a new capture revision followed by unchanged canonical publication. Capture never claims a rendered publication.

`archive_input` is selected durable input; `candidate_revision` is a local candidate; `persisted_revision` is verified remote state; `archive_output` is usable successful output only. Failure after a push retains the remote state and diagnostic persisted revision, with eligibility false and output null. A superseded request records the stale input and diagnostic without offering an advancing output.

## Exact Actions evidence

The explicitly versioned schema is `version: 2`, with stage, repository, default/application branch, archive branch/remote, run ID/attempt, origin and upstream references, selected application SHA, workflow-definition SHA, archive revisions, domain counts, outcome, advance/eligible, canonical render comparison and diagnostic. It is incompatible with v1 evidence.

Each workflow uploads exactly one `stage.json` as `v2-stage-STAGE-RUNID-ATTEMPT`, requesting 90-day retention. Retention can be shortened by repository settings or deletion. Consumers fetch the exact server attempt and require a completed successful execution in the trusted repository/head repository/default branch, the expected v2 workflow path and supported event. Definition SHA must match run metadata; manual application SHA matches that run, and automatic render inherits a trusted capture origin. Artifact ownership, record fields, output persistence, change/advancement consistency and complete render publication identities must agree.

Missing, expired, duplicate, malformed, oversized, unsafe ZIP or contradictory evidence fails clearly. Artifact members are read in memory, never extracted; redirected artifact downloads lose API credentials. HTTP/API failures remain failures. A newer attempt or failed rerun cannot replace the selected attempt; a successful older exact attempt remains usable if its exact archive revision is current.

Upload failure after persistence fails the Actions attempt. Any uploaded success-looking artifact from that attempt is unusable because the trusted server conclusion is failure. The final reporting step clears local eligibility; no synchronous child wait or dispatch holds the queue. A completed capture releases its queue before independently observable render acquires it.

## Independent recovery

- Capture acquisition/push failure: start a fresh capture. No locally committed candidate is evidence of remote success.
- Render derivation/push failure: repair the renderer and start a fresh manual render against saved capture. Recapture is unnecessary.
- Missing/expired evidence or upload/report failure: rerun the relevant stage. An unchanged capture/render verifies the durable revision and renews evidence.
- Inspect capture independently with `--advance false`; inspect render independently with its default mode. Opt into render advancement to resume the production publication chain.
- No persisted render input: run capture first. Legacy input requires coordinated cutover, never automatic conversion/reset.

## Schedule and coordinated reset

Only capture has a schedule: `17 6,12 * * *` with `Asia/Taipei`. Scheduled and default manual capture advance; capture-only opts out. Render-only is the default manual mode; `advance=true` continues to Pages. No stage waits synchronously for a child while holding the shared queue.

The local checkpoint procedure requires equivalent exclusive quiescence: disable legacy workflows, drain all legacy/new-stage work, pin the final remote legacy revision, verify exact restored blobs and reachable history, and preserve the immutable checkpoint before activation. Production writers recheck the checkpoint and legacy boundary before candidate publication. See [the runbook](v2-cutover.md). Never overwrite a conflicting ref or force-push.

Local fixture/bare-remote tests establish command, durability, trust, offline and race behavior. [The acceptance record](v2-acceptance.md) separately tracks actual hosted chaining, deployment and scheduled observation.
