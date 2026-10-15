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

The archive domain owns canonical publication identity. Presentation owns deployment identity, combining canonical publication with effective Astro/Pagefind source and supported locked build inputs. Raw chrome can change the evidence revision while both identities stay equal, suppressing deployment. Presentation fixes can change deployment identity without changing the archive. Pages compares only against server-verified actual successful deployment evidence.

Use [the archive/API contract](docs/v2-archive.md), [writer operations](docs/v2-operations.md), and [Pages and retention recovery](docs/v2-pages.md) for details. For local fixture experiments, select a separate target:

```sh
npm run --silent capture -- --data-branch local-v2 --feed-url file:///path/to/feed.xml
npm run --silent render -- --data-branch local-v2
```

## Production

Complete [the checkpoint and activation procedure](docs/v2-cutover.md) before the first production write. The implementation branch alone does not activate production; its [acceptance record](docs/v2-acceptance.md) distinguishes local checks, actual hosted runs and scheduled observations.

**V2 production capture → V2 production render → V2 production Pages** are separate Actions runs. Capture verifies remote durability before render; render verifies canonical durability before Pages. Each stage carries exact application/definition/archive revisions and upstream run/attempt evidence. All automatic/manual operations share `copilot-archive-production`, with cancellation disabled and `queue: max`. Superseded selections perform no stale push/deployment. Only the deployment job has Pages/OIDC write permission.

Capture alone runs at **06:17 and 12:17 Asia/Taipei** (`17 6,12 * * *`, `timezone: Asia/Taipei`). Scheduled and default manual capture advance; `advance=false` captures only. Manual render defaults to render-only; `advance=true` renders and publishes. Pages supports publish-only, exact failed deployment retries, force limited to duplicate suppression, and explicit retention-qualified baseline re-establishment. Render and Pages have no independent schedules.

Published articles retain `/posts/<slug>/` under `/copilot-changelog-mirror/`, source attribution, section anchors and media. The listing uses canonical publication time. Search indexes body text and titles at build time; index/build output is derived, never archive state. The site needs no runtime backend or database.

The additive [directory Capture and offline Render workflow](docs/v2-directory.md)
uses a dedicated archive checkout and ordinary Git persistence (`capture:directory`
and `render:directory`). Production entry points remain available.

The additive [saved-archive site build](docs/v2-native-site.md) uses
`site:build:directory` to build/index fresh static output with native Astro and
Pagefind, independently of capture, Git persistence and deployment.

The simplified update/publish integration is an inactive production template.
See the [isolated workflow runbook](docs/v2-isolated-workflow.md) and
[acceptance evidence](docs/v2-isolated-workflow-evidence.md) for #35.
