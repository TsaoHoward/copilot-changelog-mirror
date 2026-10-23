Copilot usage metrics now show the names of the skills, custom agents, Model Context Protocol (MCP) servers, slash commands, and plugins that your organization creates, instead of grouping them under `other` or `custom`. This builds on the [agentic CLI customization metrics](https://github.blog/changelog/2026-09-17-agentic-cli-customizations-now-in-the-usage-metrics-api/) released in September.

<a id="archive-heading-1"></a>

## [What’s new](#archive-heading-1)

-   **Named entries:** In enterprise and organization reports, including per-user 1-day and 28-day reports, aggregated 1-day reports, and `day_totals` in aggregated 28-day reports, the `totals_by_skill`, `totals_by_custom_agent`, `totals_by_mcp`, `totals_by_slash_cmd`, and `totals_by_plugin` arrays now show the configured name of a customer-defined item instead of `other` or `custom`.
-   **More entries:** Each `totals_by_*` list now includes up to 25 entries per record, up from five, so you can see more of the long tail of customizations your developers use. Any remaining activity is combined into a trailing `other` entry.
-   **Unchanged counts:** `interaction_count` and the `distinct_*_use_count` fields are calculated the same way as before.

<a id="archive-heading-2"></a>

## [Why this matters](#archive-heading-2)

The customizations that matter most to an organization are often the ones its own teams build. Administrators can now see which internal skills, custom agents, and MCP servers developers actually use, track adoption after rolling out a new one, and focus enablement where it is needed.

<a id="archive-heading-3"></a>

## [Important notes](#archive-heading-3)

-   **Coverage:** Names are reported from Copilot CLI (interactive sessions and prompt mode), the GitHub Copilot app, Agent Client Protocol (ACP) integrations such as JetBrains, and the Copilot SDK. Prompt mode, the app, and ACP integrations require Copilot CLI 1.0.97 or later. The Copilot SDK requires v1.0.21 or later. IDEs report names when their agent experiences run on the Copilot SDK v1.0.21 or later. Names aren’t reported from an IDE’s built-in chat telemetry.
-   **Configured names:** Names are reported as they are configured, trimmed and limited to 128 characters. Names that look like file paths stay grouped under `other` or `custom`. Review names before sharing reports outside your organization.
-   **Accuracy:** These metrics come from client telemetry and can undercount activity, for example when clients are outdated or telemetry is blocked. Use them to understand trends and adoption rather than for exact accounting.
-   **History:** Names appear starting with report days processed after this release. Earlier days still show `other` or `custom`.
-   **Access:** Reports are available to enterprise owners and billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the “View Copilot Metrics” permission. The Copilot usage metrics policy must be enabled.

Visit the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
