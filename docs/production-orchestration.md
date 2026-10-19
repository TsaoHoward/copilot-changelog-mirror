# Production orchestration and recovery

Use the [current production and native rollback runbook](v2-production-cutover.md). `.github/workflows/update-publish.yml` is the sole production writer/consumer/publisher; `.github/scripts/persist-stage.sh` owns ordinary completed-stage persistence. CI is independent.

Scheduled full update, manual full update, saved-source render/rebuild and saved-derived republish use fixed inputs, separate Capture/Render pushes and native Astro/Pagefind/Pages. No-change stages continue and repeated deployments are allowed. Failed or uncertain pushes require inspection; invoked deployment ambiguity requires native-status and public-content checks. Rollback preserves newer raw history.

[#36 was accepted on 2026-10-19](https://github.com/TsaoHoward/copilot-changelog-mirror/issues/36#issuecomment-6264851670), including both real scheduled publications. The schedule delays remain unexplained; configured nominal times are unchanged. [Dated evidence](v2-production-evidence.md) and [#24's historical acceptance](v2-acceptance.md) remain separate. Retired command/workflow sources are available from Git revision `64516e9d685c2082f9fa67aeccb87d113be7c480` and are unsupported operational entry points.
