The Copilot usage metrics API now shows which users are missing client telemetry or are running IDE or extension versions below the usage metrics minimums. New per-user fields appear in enterprise and organization user reports, and daily affected-user counts appear in enterprise and organization reports.

<a id="archive-heading-1"></a>

### [What’s new](#archive-heading-1)

-   **`client_telemetry_present`**: Whether client telemetry was received for the user that day. `false` means Copilot saw the user’s activity, but no usage events arrived from their editor.
-   **`usage_metrics_requirements`**: Lists each of the user’s IDEs and Copilot extensions as `met`, `unmet`, or `unknown` against the [minimum supported versions](https://docs.github.com/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics#supported-ides).
-   **`missing_client_telemetry_user_count`**: The number of users that day with `client_telemetry_present` set to `false`.
-   **`below_usage_metrics_minimum_user_count`**: The number of users that day with at least one IDE or extension below the minimum version.

<a id="archive-heading-2"></a>

### [Why this matters](#archive-heading-2)

Users without client telemetry still count as active, but their reports lack detail such as lines of code, feature breakdowns, and model breakdowns. Common causes include outdated editors or extensions, disabled IDE telemetry, and proxies or firewalls that block events. These fields show how many users are affected and who to follow up with. This way you can close gaps without opening a support ticket.

<a id="archive-heading-3"></a>

### [Important notes](#archive-heading-3)

-   **Scope:** User fields appear in enterprise and organization user reports (1-day and 28-day). Counts appear in enterprise and organization 1-day reports and in each `day_totals` entry of 28-day reports.
-   **Access:** These fields are available to enterprise owners, enterprise billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission. The Copilot usage metrics policy must be enabled.
-   **Daily counts:** Each count covers a single day. A user can be counted in both `missing_client_telemetry_user_count` and `below_usage_metrics_minimum_user_count`, so don’t add the two counts together. Don’t add counts across days to count unique users.
-   **Independent signals:** A user can meet every version minimum and still be missing telemetry (e.g., they’re behind a proxy).
-   **Unavailable values:** Null or omitted values mean the data is unavailable, not `false` or zero. Days before this release have no values.

Visit the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
