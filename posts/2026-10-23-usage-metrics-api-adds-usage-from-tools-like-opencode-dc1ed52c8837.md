The Copilot usage metrics API now reports model usage from more of the tools your developers use with Copilot, including tools like OpenCode that weren’t previously captured in your reports. A new `totals_by_client` array is available in the enterprise, organization, enterprise-user, and organization-user 1-day and 28-day reports.

<a id="archive-heading-1"></a>

### [What’s new](#archive-heading-1)

Each `totals_by_client` entry represents one client and includes:

-   **`client`**: The tool that sent the requests, such as `opencode`, `claude_code`, `codex`, `zed`, `copilot_cli`, `github_app`, `cloud_agent`, `code_review`, `vscode`, or `jetbrains`. Unrecognized clients are grouped under `other`.
-   **`request_count`**: The number of successful model requests from the client.
-   **`session_count`**: The number of distinct sessions from the client.
-   **`token_usage`**: Prompt tokens, output tokens, and average tokens per request.
-   **`totals_by_model`**: The same request and token metrics broken down by model, with a `model_selection_mode` that shows whether the model was requested directly (`user_selected`), chosen by auto (`auto`), or chosen by the product (`product_selected`). Selection modes that aren’t reported individually yet appear as `other`, and values that can’t be normalized appear as `unknown`.

<a id="archive-heading-2"></a>

### [Why this matters](#archive-heading-2)

More developers now use Copilot as the model provider behind tools outside the IDE. Because those tools often don’t send editor telemetry, their usage was missing from `totals_by_ide` and hard to account for. Counting requests on the server closes that gap, so you can see which tools drive Copilot usage, compare request and token volume across them, and base tool support and governance decisions on real usage.

This is different from [agent app activity](https://github.blog/changelog/2026-08-06-copilot-usage-metrics-api-adds-agent-app-activity/), which counts jobs started by agent apps such as Claude and Codex on GitHub. `totals_by_client` measures model traffic, meaning requests and tokens, from any tool that uses Copilot.

<a id="archive-heading-3"></a>

### [Important notes](#archive-heading-3)

-   **Scope:** Enterprise, organization, enterprise-user, and organization-user reports, in both 1-day and 28-day versions. In the aggregated 28-day reports, `totals_by_client` appears in each `day_totals` entry.
-   **Access:** Available to enterprise owners and billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission. The Copilot usage metrics policy must be enabled.
-   **Copilot code review and Copilot cloud agent:** Requests from these clients report `product_selected` because the product chooses the model. Copilot code review models are reported as `unknown`.
-   **Request counts:** `request_count` counts model calls, not prompts. One prompt can trigger several model calls, so don’t compare this field directly with prompt or interaction counts.
-   **Client identification:** Clients are identified by the integration ID they send with each request. Treat `client` as a best-effort grouping, not a verified identity.
-   **Backward compatibility:** This change is additive. Existing fields are unchanged, and `totals_by_client` is an empty array when there is no usage to report.

Visit the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
