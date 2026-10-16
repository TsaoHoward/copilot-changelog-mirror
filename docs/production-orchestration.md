# Production orchestration and recovery

The old v2 Capture → Render → Pages chain remains active during #36 preparation.
The simplified production template is unregistered in `.github/production/`.
Use [the preservation cutover/native rollback runbook](v2-production-cutover.md)
and [dated evidence and pending decisions](v2-production-evidence.md). Production
activation needs acceptance of isolated evidence and a separate explicit decision,
then old-chain disable/drain before replacement registration.

Until that switch, the old chain uses [stage operations](v2-operations.md) and
[Pages exact-evidence/retention recovery](v2-pages.md). Afterward those describe
historical operational guarantees intentionally retired by the new runbook.
[Original checkpoint/fresh bootstrap](v2-cutover.md) is historical and must not be
rerun on the existing archive. [#24 acceptance](v2-acceptance.md) remains separate.

The new chain supports `full-update`, saved-source `render-rebuild`, and saved-derived
`republish`. It rebuilds native Astro/Pagefind artifacts from retained compatible
Git inputs without legacy evidence expiry gates. Ordinary descendant pushes keep
new raw captures during known-good publication rollback. After invoked deployment
ambiguity inspect native state and actual public content before recovery.
