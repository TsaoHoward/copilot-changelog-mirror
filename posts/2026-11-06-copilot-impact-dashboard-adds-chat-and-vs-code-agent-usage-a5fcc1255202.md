![social](https://github.blog/wp-content/uploads/2026/11/696879380-eb0b2c93-698d-46a2-a934-02bbf6d7fa36.jpg?resize=2064%2C1096)

The Agent adoption chart in the Copilot impact dashboard now includes Copilot Chat and the VS Code Agents window, so you can see engagement across nine Copilot experiences. The adoption cohort called “Passive users” is now “Chat-first users”, which better describes who is in it. The enterprise and organization 28-day usage metrics reports include the same two features. This builds on [feature engagement in the Copilot impact dashboard](https://github.blog/changelog/2026-09-17-copilot-impact-dashboard-now-shows-feature-engagement/).

<a id="archive-heading-1"></a>

### [What’s new](#archive-heading-1)

-   **Agent adoption chart:** Adds Copilot Chat and the VS Code Agents window, for nine features in total.
-   **Chat-first users:** Replaces the “Passive users” cohort name. These users are active in Copilot but haven’t used a qualifying feature on at least two days in the 28-day period, so they don’t qualify for an adoption phase.
-   **`copilot_feature_engagement.totals_by_feature`**: Adds `chat` and `vscode_agent` entries to enterprise and organization 28-day reports.

<a id="archive-heading-2"></a>

### [Why this matters](#archive-heading-2)

Chat is a core Copilot experience, but the dashboard didn’t show it, and users who mainly use chat were labeled passive. Showing Copilot Chat and VS Code Agents window engagement and naming the cohort for what it represents gives a more complete picture of how developers use Copilot.

<a id="archive-heading-3"></a>

### [Important notes](#archive-heading-3)

-   **Adoption phases are unchanged:** Chat and the VS Code Agents window are reported as feature engagement but don’t count toward adoption phases. Chat-first users are still the `No Cohort` value in the API, and cohort sizes don’t change.
-   **Engagement rule:** As with the other features, a user is engaged when they used the feature on at least two days in the 28-day period. A user can be counted under more than one feature. Chat covers Copilot Chat use captured by usage metrics, including agent mode, so users who make agent edits are also counted under chat.
-   **Scope:** Like the other seven features, chat and the VS Code Agents window are only reported in enterprise and organization 28-day reports. Reports for periods before this change only include the original seven features.
-   **Access:** The data is available to enterprise owners and billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission. The Copilot usage metrics policy must be enabled.

Visit the [Copilot impact dashboard documentation](https://docs.github.com/copilot/how-tos/administer-copilot/view-impact-dashboard) and the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
