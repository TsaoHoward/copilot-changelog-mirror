# Copilot Changelog Mirror

Mirror public GitHub Copilot announcements with Node.js/TypeScript, an independent Git archive, and an Astro site with Pagefind full-text search. Production uses `mirror-data-v2`. The final v1 `mirror-data` history and `v1-final-before-v2` checkpoint remain in Git; older announcements missing from fresh discovery were never imported into v2.

## Install and verify

Use Node 22.22 from `.node-version` and Git. Archive persistence also needs an author name/email.

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

CI checks cheap domain/acquisition/normalization contracts, directory CLI and ordinary Git safety, the installed production workflow, actual offline compiler/indexer failures, and a shared real Astro/Pagefind/Chromium artifact. Changed and empty publications use their own real builds. [Case dispositions](docs/v2-cleanup-tests.md) account for the entire pre-cleanup suite; [measurements](docs/v2-cleanup-measurements.md) distinguish local CI from hosted and production costs. Historical full-corpus comparison records remain available without rebuilding that corpus in routine CI.

## Local operations and archive

Clone a **separate dedicated** `mirror-data-v2` checkout before running stages:

```sh
git clone --single-branch --branch mirror-data-v2 \
  https://github.com/TsaoHoward/copilot-changelog-mirror.git /path/to/archive
npm run capture:directory -- --archive-dir /path/to/archive
# Inspect, commit and ordinary-push Capture before Render.
npm run render:directory -- --archive-dir /path/to/archive
# Inspect, commit and ordinary-push Render before building.
npm run site:build:directory -- --archive-dir /path/to/archive \
  --output /path/to/fresh-site --base /copilot-changelog-mirror/ \
  --site https://tsaohoward.github.io
```

Follow the complete [directory CLI/Git sequence](docs/v2-directory.md); the comments above indicate required persistence steps. Directory success alone means neither remote persistence nor publication. Capture saves original `snapshots/<article_id>.html` and acquisition/discovery metadata in schema-2 `metadata.json`. Offline Render owns canonical title, publication time, stable source-slug route and body-only `posts/<article_id>.md`. Article/source identities are immutable; discovery omission retains saved articles. Identical acquisition preserves observation time, and no-change stages still allow downstream recovery.

The [saved-derived site build](docs/v2-native-site.md) reads complete metadata/bodies without raw acquisition or Git mutation. It compiles/indexes fresh output and leaves upload/deployment to the caller. Unsafe targets, symlinks, incomplete inputs and overlapping or existing output fail. A failed stage must never be committed or published.

## Production and recovery

[`.github/workflows/update-publish.yml`](.github/workflows/update-publish.yml) is the sole production chain. One archive/build job installs once, pushes complete Capture, renders offline, pushes complete Render, builds/indexes and uploads. The dependent native Pages job deploys the finished artifact. Whole-workflow concurrency spans deployment with cancellation disabled; a failed or uncertain push stops downstream work.

The four operating paths are scheduled full update at **06:17 and 12:17 Asia/Taipei**, manual full update, saved-source render/rebuild, and saved-derived republish:

```sh
gh workflow run update-publish.yml --ref main -f mode=full-update
gh workflow run update-publish.yml --ref main -f mode=render-rebuild
gh workflow run update-publish.yml --ref main -f mode=republish
```

Capture-only is an independent CLI capability. Repeated builds/deployments are allowed, including no-change recovery. Use the [current recovery and native rollback runbook](docs/v2-production-cutover.md) for non-fast-forward conflicts, failed checkouts, ambiguous deployments and fixed known-good Git inputs. Keep newer raw history during rollback.

[#36 was accepted on 2026-10-19](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6264851670): manual modes, two real scheduled publications, native known-good rollback and public Chromium checks passed. The observed schedule delays remain unexplained; no punctuality claim or cron change follows. [Dated production evidence](docs/v2-production-evidence.md), the isolated #35 evidence and historical [#24 acceptance](docs/v2-acceptance.md) remain separate. Cleanup does not sign off #24 or change the published site.

Articles retain `/posts/<slug>/` beneath `/copilot-changelog-mirror/`, source attribution, usable anchors and meaningful media references. Search indexes canonical titles and bodies; listing and navigation work without JavaScript. The site has no runtime backend or database. Retired v1 source remains under `legacy/v1/`; removed v2 mechanisms are recoverable from Git rather than supported commands.
