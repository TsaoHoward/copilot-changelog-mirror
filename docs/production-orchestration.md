# Production orchestration and recovery

Production uses `.github/workflows/update-publish.yml` (workflow `388375554`),
activated by [PR #43](https://github.com/TsaoHoward/copilot-changelog-mirror/pull/43)
on 2026-10-18 after explicit acceptance/activation decisions and two verified drain
inventories. The three old workflows are inactive; their exact definitions remain
in `.github/historical/`. CI is independent. Use
[the production/native rollback runbook](v2-production-cutover.md) and
[dated evidence and pending schedule observations](v2-production-evidence.md).

The retained [stage operations](v2-operations.md) and
[Pages exact-evidence/retention recovery](v2-pages.md) describe the historical chain.
[Original checkpoint/fresh bootstrap](v2-cutover.md) must not be rerun on the
existing archive. [#24 acceptance](v2-acceptance.md) remains separate.

The new chain supports `full-update`, saved-source `render-rebuild`, and saved-derived
`republish`. It rebuilds native Astro/Pagefind artifacts from retained compatible
Git inputs without legacy evidence expiry gates. Ordinary descendant pushes keep
new raw captures during known-good publication rollback. After invoked deployment
ambiguity inspect native state and actual public content before recovery.
