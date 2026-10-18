# Copilot Changelog Mirror

Mirror the currently discoverable public GitHub Copilot announcements with Node.js/TypeScript, an independent Git archive, and an Astro site with Pagefind full-text search. Production uses `mirror-data-v2`; the final v1 `mirror-data` history is preserved through `v1-final-before-v2`, never imported into v2. Missing older announcements are an accepted consequence of fresh discovery.

## Install and verify

Use the Node 22.22 runtime pinned in `.node-version`, Git, and an author name/email for archive commits.

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

CI runs the locked Node install, formatting, typecheck, real command/build contract tests, and shipped Chromium search acceptance. The six reviewed production fixtures retain their frozen 123 editorial blocks, links, sections and meaningful media. No Python or Ruby runtime is needed. Retired sources live under `legacy/v1/` for inspection.

## Archive and identities

The archive contains original `snapshots/<article_id>.html`, one `metadata.json` current-state manifest, and independent body-only `posts/<article_id>.md`. Capture owns evidence and discovery observations; offline render owns canonical title, publication time, route and body. `article_id` and `source_url` are immutable. Identical acquisition preserves observation time and Git history.

The archive API retains canonical publication identity for callers. The current
production workflow uses saved directory inputs and fresh native builds; historical
deployment-identity suppression and retention-qualified proof gates are retired.
See [the current production runbook](docs/v2-production-cutover.md) and
[the retained archive/API contract](docs/v2-archive.md). For local fixture experiments, select a separate target:

```sh
npm run --silent capture -- --data-branch local-v2 --feed-url file:///path/to/feed.xml
npm run --silent render -- --data-branch local-v2
```

## Production

Production uses **`.github/workflows/update-publish.yml`**, activated by
[PR #43](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/43) after verified
old-chain disable/drain. The old Capture/Render/Pages definitions are retained under
`.github/historical/`. Use [the native rollback runbook](docs/v2-production-cutover.md)
and [dated production evidence](docs/v2-production-evidence.md). Manual functional
acceptance and known-good rollback are recorded there; both real schedule
observations remain Pending, so #36 remains Open. #24 is separate.

One archive/build job installs dependencies once, acquires the real feed, ordinary
pushes Capture, renders saved source offline, ordinary pushes Render, builds with
Astro/Pagefind and uploads finished output. A dependent job performs native Pages
deployment. Failed or uncertain pushes stop downstream work. Whole-workflow
`copilot-archive-production` concurrency covers deployment, with cancellation
disabled and `queue: max`.

Scheduled full updates retain **06:17 and 12:17 Asia/Taipei**
(`17 6,12 * * *`, `timezone: Asia/Taipei`). Manual operations:

```sh
gh workflow run update-publish.yml --ref main -f mode=full-update
gh workflow run update-publish.yml --ref main -f mode=render-rebuild
gh workflow run update-publish.yml --ref main -f mode=republish
```

Use the runbook's fixed application/archive selectors for known-good republish.
Render-rebuild skips acquisition; republish skips Capture, Render and archive pushes.
Keep newer raw history during rollback. After deployment ambiguity inspect native
status and actual public content/search before another publication. Keep old
workflows inactive. [Original checkpoint/bootstrap](docs/v2-cutover.md) is historical;
do not rerun it on the existing archive.

Published articles retain `/posts/<slug>/` under `/copilot-changelog-mirror/`, source attribution, section anchors and media. The listing uses canonical publication time. Search indexes body text and titles at build time; index/build output is derived, never archive state. The site needs no runtime backend or database.

The production [directory Capture and offline Render workflow](docs/v2-directory.md)
uses a dedicated archive checkout and ordinary Git persistence (`capture:directory`
and `render:directory`). Historical stage entry points remain available for retained callers.

The production [saved-archive site build](docs/v2-native-site.md) uses
`site:build:directory` to build/index fresh static output with native Astro and
Pagefind, independently of capture, Git persistence and deployment.

The simplified update/publish integration is active in production.
See the [isolated workflow runbook](docs/v2-isolated-workflow.md) and
[acceptance evidence](docs/v2-isolated-workflow-evidence.md) for #35.
