# Simplified production cutover and recovery (#36)

**Activated by PR #43 on 2026-10-18.** Production uses
`.github/workflows/update-publish.yml` (workflow `388375554`). The old chain was
disabled and fully drained; its definitions remain in `.github/historical/`.
The installation/stop sequence below records the executed transition and must not
be repeated against the active chain. Manual/rollback results and pending actual
schedule observations are in the dated evidence. #36 remains Open.
Read [the dated evidence](v2-production-evidence.md) before any operator action.
#32 supplies design authority, #35 supplies isolated integration proof, and #24
remains a separate historical acceptance record.

## Decisions before production change

Record two distinct human decisions on #36: acceptance of #35's isolated functional
evidence (including its delivered default-branch revision), and explicit approval
to activate production in a named operating window. A merged PR, specification
approval, `ready-for-agent`, this runbook, and permission to implement supply
neither decision. An isolated scheduled event awaiting observation is separate
from isolated functional acceptance. Do all read-only preparation first.

The new guarantees are retained v2 data/identity/ownership, fixed per-run inputs,
whole-stage Capture, ordinary push C, offline Render, separate ordinary push R,
finished Astro/Pagefind output, same-workflow native upload/deploy and manual
recovery. No-change stages still push and continue. Any failed/uncertain push stops
the run; inspect the remote before a fresh dispatch. Concurrency spans the entire
workflow through deployment with `copilot-archive-production`, no cancellation,
and `queue: max`; it does not control external writers or manual old reruns.

Intentionally retired historical #17/#23/#24 operating guarantees: dual publication
and deployment identities, zero duplicate deployments, exact cross-run/attempt and
artifact handoffs, freshness/reconciliation, successful-baseline retention proof
and renewal, hermetic build-closure identity, daily checkpoint/reset-witness checks,
and raw-integrity auditing on every republish. Capture/Render integrity and this
one-time migration audit remain. Old code/tests stay available; old proof expiry
must not block a native rebuild. These retirements do not pass #24's pending matrix.

## Read-only preparation and one-time recoverability audit

Use a fresh directory and the real repository; never initialize or reset an archive.
The fixed known-good pair actually rebuilt/published during activation is application
`9cca716865717a50fa02066b98bfa0e2bbba247b` with complete-derived archive
`0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`. The application already contains the
three replacement commands. Public base is `/copilot-changelog-mirror/`, origin
`https://tsaohoward.github.io`. Recheck compatibility if choosing another pair.

```bash
set -euo pipefail
repo=TsaoHoward/copilot-changelog-mirror
audit=$(mktemp -d /tmp/copilot-cutover.XXXXXX)
application=9cca716865717a50fa02066b98bfa0e2bbba247b
derived=0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11
git clone --mirror "https://github.com/$repo.git" "$audit/repository.git"
git --git-dir="$audit/repository.git" show-ref > "$audit/refs-before.txt"
git --git-dir="$audit/repository.git" fsck --full --no-reflogs
mkdir "$audit/checkpoint" "$audit/current" "$audit/derived" "$audit/app"
git --git-dir="$audit/repository.git" archive v1-final-before-v2 | tar -x -C "$audit/checkpoint"
git --git-dir="$audit/repository.git" archive mirror-data-v2 | tar -x -C "$audit/current"
git --git-dir="$audit/repository.git" archive "$derived" | tar -x -C "$audit/derived"
git --git-dir="$audit/repository.git" archive "$application" | tar -x -C "$audit/app"
```

Verify **every** restored file's mode and blob, not just ref resolution:

```bash
verify_restoration() {
  local revision=$1 directory=$2 record mode type oid file
  while IFS= read -r -d '' record; do
    file=${record#*$'\t'}
    read -r mode type oid <<< "${record%%$'\t'*}"
    [[ $type == blob && ( $mode == 100644 || $mode == 100755 ) ]]
    [[ -f "$directory/$file" && ! -L "$directory/$file" ]]
    [[ $(git hash-object --no-filters "$directory/$file") == "$oid" ]]
    if [[ $mode == 100755 ]]; then test -x "$directory/$file"; else test ! -x "$directory/$file"; fi
  done < <(git --git-dir="$audit/repository.git" ls-tree -rz "$revision")
}
verify_restoration v1-final-before-v2 "$audit/checkpoint"
verify_restoration mirror-data-v2 "$audit/current"
verify_restoration "$derived" "$audit/derived"
git --git-dir="$audit/repository.git" rev-list --count v1-final-before-v2
git --git-dir="$audit/repository.git" rev-list --count mirror-data-v2
git --git-dir="$audit/repository.git" merge-base --is-ancestor v2-initial-capture mirror-data-v2
```

Inspect historical HTML/JSON sidecars/Markdown and original front matter. Preserve
`mirror-data`, `v1-final-before-v2`, `v2-reset-input` (annotated tag object and peeled
target) and `v2-initial-capture` without recreating them. Resolve/review reset proof
contents as historical data; do not infer unknown checkpoint-operation ordering.

Validate current v2 schema/identity/routes, Capture metadata and each snapshot hash.
This uses the existing archive validator, which also rejects unexpected managed
files and mismatching evidence. Run from the fixed application after `npm ci`:

```bash
cd "$audit/app"
npm ci
ARCHIVE_AUDIT_DIR="$audit/current" node --import tsx --input-type=module <<'JS'
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readManifest, sha256} from './src/v2/domain.ts';
import {validateDirectoryArchive} from './src/v2/directory-archive.ts';
const dir=process.env.ARCHIVE_AUDIT_DIR, files=new Map();
for (const name of readdirSync(dir)) {
  if (['snapshots','posts'].includes(name)) for (const file of readdirSync(join(dir,name)))
    files.set(`${name}/${file}`, {mode:'100644', bytes:readFileSync(join(dir,name,file))});
  else files.set(name, {mode:'100644', bytes:readFileSync(join(dir,name))});
}
const manifest=readManifest(files.get('metadata.json').bytes);
validateDirectoryArchive({manifest,files});
const inventory=Object.values(manifest.articles).map(a=>({...a,
  verified_snapshot_sha256:sha256(files.get(`snapshots/${a.article_id}.html`).bytes)}));
writeFileSync(join(dir,'../raw-inventory.json'), JSON.stringify(inventory,null,2)+'\n');
console.log(`Validated ${inventory.length} retained articles`);
JS
npm run --silent site:build:directory -- --archive-dir "$audit/derived" \
  --output "$audit/site" --base /copilot-changelog-mirror/ \
  --site https://tsaohoward.github.io
```

Inspect finished listing/routes/assets and Pagefind output before uploading. Run
the reader check below against a locally served build first. Build success proves
compatible saved inputs, not a new hosted rollback. Keep inventory exports and
counts/hashes/SHAs in the evidence record. If canonical data is incomplete, select
a retained complete-derived revision; keep newer raw data in the archive branch.
Do not require retained old Actions artifacts. Repeat the audit against newly
fetched refs after draining if production advanced since preparation.

## Approved stop, drain, install, activate sequence

**The following changes require the separate recorded activation decision.**
Prepare an activation PR from updated `main` only after that decision. Do not merge
it until the old chain is disabled and drained. Coordinate maintainers to prevent
manual dispatches, old reruns, external writes and reactivation during observation.

```bash
gh workflow disable v2-capture.yml --repo "$repo"
gh workflow disable v2-render.yml --repo "$repo"
gh workflow disable v2-pages.yml --repo "$repo"
gh api "repos/$repo/actions/workflows" --paginate --jq '.workflows[] | {id,path,state}'
gh api "repos/$repo/actions/runs?per_page=100" --paginate \
  --jq '.workflow_runs[] | select(.workflow_id == 381740224 or .workflow_id == 381740225 or .workflow_id == 381887694) | {id,status,conclusion,head_sha,html_url}' \
  | jq -s '.' > "$audit/old-runs.json"
jq '[.[] | select(.status != "completed")]' "$audit/old-runs.json"
gh api "repos/$repo/deployments?environment=github-pages&per_page=100" --paginate > "$audit/deployments.json"
```

Inspect jobs for every nonterminal run with `gh run view RUN --repo "$repo" --json
jobs`; include running, queued, pending, waiting, requested, action-required and
environment-waiting work. Let it finish or deliberately `gh run cancel RUN --repo
"$repo"`, then verify terminal state. Reinventory **after** completions to catch
new `workflow_run` consumers. Inspect each relevant deployment's `/statuses`
endpoint and its Pages job; a run conclusion alone does not resolve deployment
ambiguity. Record the last old successful public content. If any old work or
in-flight native deployment remains uncertain, stop here.

In the approved activation branch, preserve old definitions outside registration:

```bash
mkdir -p .github/historical
git mv .github/workflows/v2-capture.yml .github/historical/v2-capture.yml
git mv .github/workflows/v2-render.yml .github/historical/v2-render.yml
git mv .github/workflows/v2-pages.yml .github/historical/v2-pages.yml
cp .github/production/update-publish.yml .github/workflows/update-publish.yml
npm run format:check
npm run typecheck
node --import tsx --test tests/v2/production-workflow.test.ts tests/v2/isolated-workflow.test.ts
node --import tsx --test --test-name-pattern='retained legacy' tests/v2/stage-actions.test.ts tests/v2/pages.test.ts
```

The contracts support both preparation and installed sole-chain source layouts;
they do not prove hosted workflow states. Keep `.github/isolated/persist-stage.sh`:
it is the already tested fixture-independent ordinary persistence helper, shared
by both templates. Do not copy isolated fixture source, application overrides or
acquisition preloads. Install the reviewed production template unchanged.

After review, merge the activation PR while the old workflows remain disabled and
drained. A newly registered schedule can start immediately; readiness must precede
that merge. Enable `update-publish.yml` only if it registered disabled. Inventory
workflow states/runs/deployments again. Exactly one production path must be active;
CI is independent. Keep old workflows disabled even after their definitions move,
and prohibit old reruns. Shared concurrency is a supplement to this drain.

## First publication and manual modes

Scheduled runs always select `full-update`; manual default is also full update.
Both jobs guard the exact repository, default branch and schedule/dispatch events.
Application and archive are separate fixed checkouts. Requested application must
be a full SHA in trusted default-branch history with compatible commands; explicit
archive SHA is republish-only and must be retained in archive ancestry.

```bash
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=full-update
# After that run completes and its outcome/publication is inspected:
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=render-rebuild
# The known-good republish below also provides rollback evidence; avoid redundant runs.
```

Record the actual selected/pushed C/R SHAs and counts in summaries and remote Git.
Full update acquires only the real GitHub Blog feed. Render-rebuild skips Capture
and preserves acquisition bytes/fields. Republish skips both stages and both
pushes; archive/build retains contents-write permission but that mode is read-only.
Only the dependent deploy job has Pages/OIDC, no application install there. Build
must finish complete Astro compilation and Pagefind indexing before native upload;
upstream failure prevents deploy. No-change still continues downstream.

Compare before/after identity sets, Capture fields, snapshot hashes, refs and
ancestry. New raw differences must trace to legitimate Capture; discovery omission
must not remove stored articles. Verify C → R ordinary descendant commits. Never
force-push, rewind, rebase/reconcile automatically, or persist a partially failed
checkout. Failed/uncertain push is a failed stage even if bytes reached the server.

After each selected publication, run the same reader check using its saved inputs:

```bash
ARCHIVE_DIR="$audit/derived" \
SITE_URL=https://tsaohoward.github.io/copilot-changelog-mirror/ \
node --import tsx --test tests/v2/production-site.browser.ts
```

Run this from the reviewed preparation/activation checkout (the older known-good
application predates this reader script). Select the archive matching the actual
publication, not a moving tip; re-export it if needed. The check covers listing
order/date/title, all retained routes and source attribution, representative heading
anchor, image/video references, local assets, title/body search and result navigation.
The authentic October 9 weekly announcement is its fixed representative; if a
chosen older complete revision lacks it, select/review another independent saved
expectation explicitly. External media requests are blocked: references are checked,
not upstream availability or permanent media archival. Keep old-site observations
separate from first replacement publication.

## Known-good rollback and uncertainty

This executable fresh native rebuild/publish was verified in Production by run
`39122524338`, including public reader/search and unchanged archive refs:

```bash
git ls-remote "https://github.com/$repo.git" refs/heads/mirror-data-v2 > "$audit/before-republish.txt"
gh workflow run update-publish.yml --repo "$repo" --ref main \
  -f mode=republish \
  -f application_sha=9cca716865717a50fa02066b98bfa0e2bbba247b \
  -f archive_sha=0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11
# Identify the newly created run by event/time/inputs; do not select an unrelated latest run.
gh run list --repo "$repo" --workflow update-publish.yml --event workflow_dispatch --limit 10
# gh run watch ACTUAL_RUN_ID --repo "$repo" --exit-status
# Inspect native jobs/deployment, then run the public check against $audit/derived.
git ls-remote "https://github.com/$repo.git" refs/heads/mirror-data-v2 > "$audit/after-republish.txt"
diff -u "$audit/before-republish.txt" "$audit/after-republish.txt"
```

Recheck complete-derived tree/history and raw inventory too. The archive branch
keeps its newest descendants and raw captures while the public site may use older
known-good content. Alternatively make ordinary forward corrective application or
derived commits preserving Capture fields and use render-rebuild/republish. Keep
old source, but restoring old workflows alone is not verified rollback because
legacy evidence may expire. Fresh build/upload avoids that dependency.

If deployment was invoked and response/reporting is uncertain, inspect run/job,
native deployment `/statuses`, environment and actual public content/search before
deciding recovery. Stop further bad publications as necessary while keeping the
other chain disabled. A failed response does not prove the old site survived.
Use isolated #35 failure evidence for destructive cases; never corrupt production,
race live writers, delete evidence or inject fixtures to manufacture failure proof.

## Schedule observations, costs and sign-off

Preserve `17 6,12 * * *`, `timezone: Asia/Taipei`: nominal 06:17 is previous-day
22:17 UTC; nominal 12:17 is 04:17 UTC. For each actual new `schedule` event record
nominal opportunity, created time, job start/queue/execution, inputs/pushes,
native conclusion/deployment and public result. Inspect original native event and
workflow revision for the October 13 discrepancy; its current unresolved finding
is in the evidence record. Do not infer a timezone correction or rewrite schedule.
Manual success or configured YAML never substitutes for either schedule event.
Missing observation stays pending with next check; platform delay and failed run
are distinct. Successful manual recovery does not change a scheduled failure.

For costs export `gh api repos/$repo/actions/runs/RUN/jobs --paginate` and
`gh run view RUN --log`. Record SHA/lock/tool/runner/corpus/base/mode and cache,
install conditions/repetitions, failed/extra attempts, invocation count, queue versus
execution, installs, stages/pushes, build/index, upload/deploy, job and pipeline times.
Compare the old three-run handoff with the complete new workflow. Native step
intervals can contain several operations: disclose when finer timing is unavailable.
Separate local builds, routine CI, isolated evidence and production measurements;
structural install savings are inferred until comparable production observations.

Update every acceptance row in the evidence record as passed, failed or pending,
with dated URLs and remediation/next observation. Record decisions, drain and
sole-path inventories before/after first publication, manual paths, rollback,
post-cutover raw/ancestry comparison and both actual schedule events. Pending
schedule or activation means #36 is not fully accepted. Do not close or rewrite #24.
