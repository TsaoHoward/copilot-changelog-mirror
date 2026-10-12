# v1 checkpoint and v2 production activation

Prepare and validate the whole application/workflow change on the issue branch before changing hosted production. The implementation alone is not hosted acceptance. Do not merge/activate before the checkpoint gate succeeds. Production archive mutations use `npm run stage`; reset outside Actions requires the exclusive quiescence below.

## Freeze and verify the final v1 archive

1. Disable `mirror-and-publish.yml`, `render-posts.yml` and `publish-pages.yml` through `gh workflow disable`. Stop new manual dispatch. Inventory all runs; allow running, queued, pending and waiting legacy consumers to finish or cancel them deliberately and confirm completion. An old Pages job must not deploy after v2 activation. If the v2 production workflows have already been installed, disable them and drain their work too. No new production stage may run concurrently with checkpoint/bootstrap preparation.
2. Re-read the exact final remote `mirror-data` SHA. Keep the prior public deployment live; no archive is deleted or rewritten. Use a clean checkout of this implementation with locked dependencies and authenticated Git/Actions read access.
3. Preserve and verify the checkpoint with the real operator command:

   ```sh
   npm run --silent cutover -- checkpoint \
     --repo /path/to/implementation --repository TsaoHoward/copilot-changelog-mirror \
     --legacy-revision EXACT_FINAL_V1_SHA --state /tmp/v1-checkpoint.json
   ```

   The command checks server workflow/run inventory, restores the exact selected v1 revision into a disposable checkout, checks original file modes and blob hashes, front matter and reachable history with Git fsck, then atomically pushes the immutable lightweight `v1-final-before-v2` tag and an annotated `v2-reset-input` proof bound to that same v1 revision. The latter records the selected absent/empty production input outside the archive manifest. It verifies remote resolution and rereads both legacy and fresh-target state. Caller HEAD, index, uncommitted work and local refs remain intact. No force push occurs.

4. Export `/tmp/v1-checkpoint.json` to the #24 acceptance comment. Record the SHA/tag/tree inventory, raw HTML/sidecar/Markdown counts, history count, exact UTC/Taipei observation times and verification result. Keep a durable copy of the report beyond ephemeral Actions artifacts.

`mirror-data-v2` must be absent or genuinely empty. A prior verification corpus, even if valid v2, is unexplained state and checkpoint preparation refuses it. An absent target receives independent orphan ancestry through real capture; an existing empty target retains its own ancestry. Conflicting checkpoint refs, restoration/API failures, late legacy writes and competing bootstrap state stop activation without destructive fallback. If checkpoint succeeds but activation is postponed, keep writers paused so the checkpoint stays final. Investigate a conflict rather than replacing the immutable tag.

## Activate the compatible chain

After review/approval and the verified checkpoint, install the complete change on the default branch together: retire the three legacy workflows, activate `v2-capture.yml`, `v2-render.yml` and `v2-pages.yml` on `mirror-data-v2` with the shared `copilot-archive-production` queue. Enable the new workflows if they were disabled during preparation. Only capture schedules `17 6,12 * * *` with `Asia/Taipei`. No verification consumer publishes to the live site.

```sh
npm run --silent cutover -- verify \
  --repo /path/to/default-branch-checkout --repository TsaoHoward/copilot-changelog-mirror

gh workflow run v2-capture.yml --ref main -f advance=true
```

Each production writer independently verifies the remote checkpoint, restored v1 evidence, quiescence and unchanged legacy boundary before mutation. Before the first capture, the target must still equal the immutable reset input. First capture atomically publishes its archive revision and the immutable `v2-initial-capture` witness; a marker push failure leaves both absent. Later writers require archive ancestry descended from that witness. Copying a valid verification corpus into the target after checkpoint is rejected, never silently continued. Successful fresh capture persists raw evidence before independent offline render begins. Render persists body-only Markdown/canonical metadata before independent Pages begins. Actions/API/artifact upload failures stop advancement. GitHub's default `GITHUB_TOKEN` branch push is not the stage trigger; exact successful `workflow_run` attempts are.

Record the three distinct run URLs/attempts, application/definition/input/candidate/persisted/output archive SHAs, persistence order, both identities, preparation/build artifact association and completed deployment job/step/results. Check the public [archive](https://tsaohoward.github.io/copilot-changelog-mirror/): chronological listing, article routing, attribution, fragments/media, title/body search and repository base paths. The prior site remains until a new actual deployment succeeds.

## Independent recovery

```sh
# Capture only
 gh workflow run v2-capture.yml --ref main -f advance=false
# Render only, renew exact render evidence without acquisition
 gh workflow run v2-render.yml --ref main -f advance=false
# Render and publish
 gh workflow run v2-render.yml --ref main -f advance=true
# Publish current verified render; explicit selectors must come as a pair
 gh workflow run v2-pages.yml --ref main
 gh workflow run v2-pages.yml --ref main -f render_run_id=RUN -f render_attempt=ATTEMPT
# Original preparation/artifact must still exist for deployment-only retry
 gh run rerun PAGES_RUN --failed
# Equality alone may be bypassed
 gh workflow run v2-pages.yml --ref main -f force=true
# Positively established successful-baseline proof expiry only
 gh workflow run v2-pages.yml --ref main -f reestablish=true
```

Use [the Pages retention decision tree](v2-pages.md). Expired build bytes allow fresh publish-only rebuilding; expired render evidence needs render-only renewal; expired successful baseline proof fails ordinary publication and force and requires explicit qualified re-establishment. Unexpected missing/contradictory/API-failed proof requires investigation. Superseded exact selections never move to the tip, even with force. Failures preserve durable inputs and the prior successful live site.

## Inspect or restore checkpoint evidence

After fetching the immutable tag, create a disposable clone and detach at it:

```sh
git clone https://github.com/TsaoHoward/copilot-changelog-mirror.git /tmp/copilot-v1-inspection
git -C /tmp/copilot-v1-inspection checkout --detach v1-final-before-v2
git -C /tmp/copilot-v1-inspection fsck --strict
git -C /tmp/copilot-v1-inspection ls-tree -r HEAD
```

The checkout restores original snapshots, paired sidecars and front-matter Markdown with ordinary reachable history. This procedure is inspection/recovery, not automatic v1 reactivation, v2 migration or historical rollback publication.

## Hosted scenario discipline

Use real upstream capture for the live corpus. If raw-only upstream churn is unpredictable, run reviewed fixtures in a separate acceptance archive/environment through the same production commands and an actual hosted Pages deployment boundary with its own baseline. Never inject fake source bytes into production. Deliberate canonical edits, failures, races and retention simulations also use isolated targets. Upload-only workflows or stubbed deployment prove no hosted suppression.

Record each scenario's scope and all provenance fields in [the acceptance matrix](v2-acceptance.md) and on #24. Observe the next real `schedule` event separately; a manual dispatch or correct cron text is not scheduled-run proof. Keep any unobserved case explicitly pending.
