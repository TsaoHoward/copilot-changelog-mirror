# Production operation and native rollback

Production uses `.github/workflows/update-publish.yml` (workflow `388375554`), installed by PR #43 after the old chain was disabled and drained. [#36's acceptance on 2026-10-19](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6264851670) includes both actual schedule events and public browser checks. The dated audit/activation evidence remains in [v2-production-evidence.md](v2-production-evidence.md). The executed migration procedure is recoverable at Git revision `64516e9d685c2082f9fa67aeccb87d113be7c480`; do not repeat its archive initialization or trigger cutover.

## Four operating paths

| Path                    | Acquisition | Offline Render | Archive pushes      | Fresh build/index/upload/deploy |
| ----------------------- | ----------- | -------------- | ------------------- | ------------------------------- |
| Scheduled full update   | Yes         | Yes            | Capture then Render | Yes                             |
| Manual `full-update`    | Yes         | Yes            | Capture then Render | Yes                             |
| Manual `render-rebuild` | No          | Saved source   | Render only         | Yes                             |
| Manual `republish`      | No          | No             | None                | Complete saved derived input    |

The configured cron remains `17 6,12 * * *` with `Asia/Taipei`, nominally 06:17 and 12:17. Actual 2026-10-19 schedule runs occurred at 08:11:58 and 17:51:13 Taipei. Native records establish two real scheduled successes, but do not independently identify their exact nominal slots or explain the delay. Preserve this limitation for separate scheduler review; never silently change cron/timezone.

```sh
repo=TsaoHoward/copilot-changelog-mirror
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=full-update
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=render-rebuild
gh workflow run update-publish.yml --repo "$repo" --ref main -f mode=republish
```

Select one operation, inspect its completion and public outcome before recovery. Capture-only remains a [directory CLI capability](v2-directory.md), rather than a production mode. Both jobs require the exact repository, default branch and schedule/dispatch event. The application is selected once from trusted default-branch history. The archive checkout is selected once; explicit full archive SHA is allowed only for republish and must belong to retained archive ancestry.

Actions owns sequencing, separate ordinary Capture/Render commits and pushes, artifact transfer and native Pages deployment. `.github/scripts/persist-stage.sh` persists only a completed stage. Capture must be confirmed pushed before Render; Render before build. No-change stages avoid empty commits but still confirm an ordinary push and continue. Repeated builds/deployments are allowed. No identity hash, successful-deployment baseline, run-attempt proof or expiry artifact authorizes recovery.

The archive/build job installs locked dependencies once. Only deploy has Pages/OIDC permission; republish's archive/build job retains contents-write permission but skips archive writes. Whole-workflow `copilot-archive-production` concurrency covers deployment, has cancellation disabled and `queue: max`. It does not lock external writers.

## Failures and manual recovery

CLI directory success describes validated local files. A commit, confirmed ordinary push and hosted publication are distinct outcomes. Inspect JSON results, native job/step summaries and the remote before proceeding.

- Acquisition/normalization/input-validation failure: no successful batch is available to commit. Repair the application or upstream condition, then rerun the appropriate mode.
- Local filesystem completion failure: the disposable checkout may contain partial files. Do not commit/push them. Preserve the saved revision and prepare a fresh dedicated checkout; inspect remaining local work before disposal.
- Commit failure: inspect the local index/author/hooks and remote. No downstream work should run.
- Non-fast-forward or uncertain push: stop, fetch/inspect both histories and compare local candidate with the remote. Preserve competing/new Capture history. Use a fresh checkout from the confirmed remote tip for a later run, or prepare reviewed forward corrective commits. Never force-push, automatically rebase/reset or overwrite the competitor.
- A build/index/upload failure blocks dependent deployment. Durable Capture/Render remains available for render-rebuild or republish. Build requires every canonical record/body, safe routes/paths and fresh output; finish Render if a new capture is incomplete.
- Once deployment was invoked, a failed/ambiguous response does not prove old public bytes survived. Inspect native run/jobs, the environment/deployment status and actual public content/search before deciding the next publication.

```sh
gh run view ACTUAL_RUN_ID --repo "$repo" --json status,conclusion,jobs,headSha,url
gh api "repos/$repo/deployments?environment=github-pages&per_page=20"
# Select the relevant deployment, then inspect its statuses:
gh api "repos/$repo/deployments/DEPLOYMENT_ID/statuses"
```

## Executable known-good rollback

The accepted rollback pair is application `9cca716865717a50fa02066b98bfa0e2bbba247b` and complete-derived archive `0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11`. Production run [39122524338](https://github.com/TsaoHoward/copilot-changelog-mirror/actions/runs/39122524338) rebuilt/published this pair and passed public checks without rewinding the archive. The application already contains the directory/native commands, and its old surrounding modules are not invoked by this path. Inputs are ordinary reachable Git history; old Actions artifacts and proof gates are unnecessary. Cleanup also verifies a native rebuild of these derived inputs with the current application.

```bash
set -euo pipefail
repo=TsaoHoward/copilot-changelog-mirror
recovery=$(mktemp -d /tmp/copilot-recovery.XXXXXX)
git clone --mirror "https://github.com/$repo.git" "$recovery/repository.git"
application=9cca716865717a50fa02066b98bfa0e2bbba247b
derived=0ce0a0e922c87cedccbd3cdc2165ce3037fd0e11
git --git-dir="$recovery/repository.git" cat-file -e "$application^{commit}"
git --git-dir="$recovery/repository.git" merge-base --is-ancestor "$application" refs/heads/main
git --git-dir="$recovery/repository.git" merge-base --is-ancestor "$derived" refs/heads/mirror-data-v2
mkdir "$recovery/derived"
git --git-dir="$recovery/repository.git" archive "$derived" | tar -x -C "$recovery/derived"
# From the current installed application, inspect a local rebuild before publication:
npm run site:build:directory -- --archive-dir "$recovery/derived" \
  --output "$recovery/site" --base /copilot-changelog-mirror/ \
  --site https://tsaohoward.github.io

# When deliberately restoring known-good public content:
git ls-remote "https://github.com/$repo.git" refs/heads/mirror-data-v2 > "$recovery/archive-before.txt"
gh workflow run update-publish.yml --repo "$repo" --ref main \
  -f mode=republish -f application_sha="$application" -f archive_sha="$derived"
gh run list --repo "$repo" --workflow update-publish.yml --event workflow_dispatch --limit 10
# Identify this dispatch by event/time/inputs, then:
# gh run watch ACTUAL_RUN_ID --repo "$repo" --exit-status
# Inspect native deployment and public content before claiming rollback success.
git ls-remote "https://github.com/$repo.git" refs/heads/mirror-data-v2 > "$recovery/archive-after.txt"
diff -u "$recovery/archive-before.txt" "$recovery/archive-after.txt"
```

The archive branch keeps its newest descendants and raw captures even when the public site uses older complete-derived input. Forward corrective application/derived commits are another recovery option; preserve Capture-owned fields. To restore the newest complete publication after rollback, use manual republish with no archive selector, following inspection of that input. Do not reactivate the old workflows or reset/bootstrap the current archive.

## Public verification and historical inputs

Use the retained opt-in reader check from the current application against the **archive matching the actual publication**:

```sh
ARCHIVE_DIR=/path/to/selected-derived-export \
SITE_URL=https://tsaohoward.github.io/copilot-changelog-mirror/ \
node --import tsx --test tests/v2/production-site.browser.ts
```

It checks listing/order/date/title/routes/attribution, representative anchors/media/base assets, executed title/body searches and navigation. It requires the authentic October 9 weekly article; an older selected publication requires separately reviewed expectations rather than a fabricated pass. External media requests are blocked: references are checked, not permanent upstream availability. The rollback pair's accepted public checks remain in dated #36 evidence.

Retain `mirror-data`, `mirror-data-v2`, `v1-final-before-v2`, annotated `v2-reset-input`, and `v2-initial-capture`. Discover them with `git show-ref` in a mirror clone; use `git archive REF` in a fresh directory and `git fsck --full --no-reflogs` to inspect recoverability. Ref existence alone does not establish original-byte integrity; #36's audit recorded restored blobs/modes, hashes and ancestry. Do not recreate historical refs. Current Capture/Render validates raw joins; republish reads canonical metadata/bodies only.

This cleanup authorizes no production dispatch or new site change. #24's historical hosted acceptance remains separate. [Final test ownership](v2-cleanup-tests.md), [cleanup evidence](v2-cleanup-evidence.md), and [measurements](v2-cleanup-measurements.md) describe what local and hosted CI checks establish.
