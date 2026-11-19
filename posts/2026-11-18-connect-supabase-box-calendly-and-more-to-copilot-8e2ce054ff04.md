You can now connect eight more services to Copilot using GitHub-verified MCP servers, or connectors, available in public preview. They join more than 25 services you can already connect, like Slack, Figma, and Sentry. To see the full list, open Customize in the Copilot app or browse the [Copilot customization page](https://github.com/copilot/customize?utm_source=connectors-changelog-customize-tab&utm_medium=changelog&utm_campaign=connectors-new-services).

<a id="archive-heading-1"></a>

### [New services you can connect](#archive-heading-1)

-   **Box**: Search and manage content, and use Box AI.
-   **Buildkite**: Work with pipelines and builds.
-   **Calendly**: Manage scheduling and meetings.
-   **ClickUp**: Track tasks and projects.
-   **Mixpanel**: Explore product analytics.
-   **Supabase**: Work with projects and databases.
-   **Webflow**: Manage sites and content.
-   **Wix**: Manage sites and business tools.

For example, you can ask Copilot why your latest Buildkite build failed and have it fix the code in the same session, or have it check your Supabase schema before it writes a migration.

Connect these services once, and you can use them across Copilot.

<a id="archive-heading-2"></a>

### [Connect a service](#archive-heading-2)

You connect these services the same way as any other connector:

-   **Copilot app**: Open **Customize** and select **Connect** on the service you want.
-   **Copilot CLI**: Run `/mcp`, switch to the **Connectors** tab, and select **Connect** on the service you want.
-   **VS Code**: Open the Agents window, go to **Customizations**, and connect the service you want.
-   **github.com**: Browse services on the [Copilot customization page](https://github.com/copilot/customize?utm_source=connectors-changelog-customize-tab&utm_medium=changelog&utm_campaign=connectors-new-services) and select the service you want.

<a id="archive-heading-3"></a>

### [Availability](#archive-heading-3)

Connectors are in public preview for all Copilot plans. With Copilot Business or Copilot Enterprise, an admin needs to enable the `Editor preview features` policy. If your enterprise’s MCP allowlist lists connectors individually rather than with a wildcard, an admin also needs to [add the new connectors](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist#allowing-copilot-connectors) to it. Some services also need to be enabled by an admin on their side, such as allowing Box MCP access.

See all [supported connectors](https://docs.github.com/copilot/reference/supported-connectors), and share feedback in our [Community discussion](https://github.com/orgs/community/discussions/211002?utm_source=connectors-changelog-community-discussion&utm_medium=changelog&utm_campaign=connectors-new-services).

Happy coding! 💙
