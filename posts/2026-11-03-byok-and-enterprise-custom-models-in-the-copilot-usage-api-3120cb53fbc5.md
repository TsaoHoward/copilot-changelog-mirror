The Copilot usage metrics API now shows bring your own key (BYOK) usage across GitHub Copilot, so you can separate it from Copilot-hosted model usage. Reports cover two kinds of BYOK:

-   **Local BYOK** is configured by developers in their client. Requests go from Copilot CLI or the GitHub Copilot app directly to the developer’s provider key or local model. Find it in `used_local_byok`, `totals_by_local_byok`, and active local BYOK user counts.
-   **Enterprise custom models** are configured by admins in GitHub settings, and requests route through GitHub to your provider. Find them with `is_custom_enterprise_model` in `totals_by_client`.

Both appear in enterprise and organization reports, at the user and aggregate level, in 1-day and 28-day reports.

<a id="archive-heading-1"></a>

### [Local BYOK](#archive-heading-1)

Local BYOK covers a developer’s own provider key and local models served by tools such as Ollama, Foundry Local, LM Studio, and llama-server.

-   **`used_local_byok`**: Whether a user made at least one local BYOK request in Copilot CLI or the Copilot app that day. Appears in user-level reports.
-   **`totals_by_local_byok`**: Session, request, prompt, and token counts, broken out by `byok_kind` (`local_managed`, `local_user`, `local_auto`, or `remote_user`) and `surface` (`copilot_cli` or `copilot_app`). Appears in user-level and aggregate reports.
-   **`daily_active_local_byok_users`, `weekly_active_local_byok_users`, and `monthly_active_local_byok_users`**: Distinct users with local BYOK activity for the day, calendar week, and calendar month. Appears in aggregate reports.

<a id="archive-heading-2"></a>

### [Enterprise custom models](#archive-heading-2)

-   Added `is_custom_enterprise_model`, a boolean on each `totals_by_client[].totals_by_model[]` entry. Its value is `true` when the request used a custom model configured for your enterprise or organization. GitHub observes these requests server-side, so the field covers every client, including IDEs.
-   A model used both as a Copilot-hosted model and as a custom model appears as two entries, so the counts stay separate.
-   Custom model entries include real request and token counts.

<a id="archive-heading-3"></a>

### [Why this matters](#archive-heading-3)

BYOK usage used to blend into Copilot-hosted totals, because local and custom models often share names with Copilot models. Now you can:

-   **Govern BYOK:** See who sends requests to their own provider keys, local models, or enterprise custom models, and check that against your BYOK policy.
-   **Understand spend:** Separate Copilot-hosted usage from usage billed by your own provider or run on free local models, so cost per user reflects what Copilot actually serves.
-   **See across all tools:** Get one view of AI usage in your enterprise, whichever model or provider your developers choose.
-   **Compare efficiency:** Group users by BYOK or custom model usage and compare them against the Copilot usage metrics you already track.

<a id="archive-heading-4"></a>

### [Important notes](#archive-heading-4)

-   **No change to existing totals:** BYOK usage is already counted. Local BYOK is a subset of `totals_by_cli` and `totals_by_copilot_app`, and custom model usage is already in `totals_by_client`. Existing totals are unchanged.
-   **Lower bound for local BYOK:** Local BYOK fields rely on client telemetry, so they undercount when telemetry is disabled. Token counts can also undercount because some local providers don’t report token usage. Enterprise custom model counts are observed server-side and don’t have this limitation.
-   **Model names:** Custom model names use the existing model name normalization, so unrecognized names appear as `unknown`. Local BYOK usage isn’t broken out by model name.
-   **No backfill:** Report days before this release don’t include `is_custom_enterprise_model`.
-   **Access:** Available to enterprise owners, enterprise billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission. The Copilot usage metrics policy must be enabled.

Visit the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
