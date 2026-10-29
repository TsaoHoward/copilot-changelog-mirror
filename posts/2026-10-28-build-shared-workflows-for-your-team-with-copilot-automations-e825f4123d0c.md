Shared Copilot Automations are rolling out, enabling teams to build and maintain AI-powered workflows together.

With Copilot Automations, you can combine prompts, triggers, and tools to design workflows around the way your team works. Copilot runs autonomously in the cloud, using only the tools you’ve allowed. For example, you could create automations to:

-   Reproduce bugs as soon as an issue is opened.
-   Capture screenshots of the changes when a pull request is marked as ready.
-   Automatically investigate production incidents as soon as they’re detected in your monitoring tool.

Until now, automations have been personal, meaning only you could see and edit them, and they used your identity and AI credits. That works well for automating your own work, like drafting your standup updates, but not for workflows your whole team relies on. Shared automations let your team build and maintain those workflows together.

<a id="archive-heading-1"></a>

## [How shared automations work](#archive-heading-1)

-   **Visible to your team**: Everyone with read access to the repository can see a shared automation, and anyone with write access can edit it.
-   **Billed to the repository owner**: AI credits are billed to the organization or user that owns the repository, rather than to the person who created the automation.
-   **Act as Copilot**: Actions on GitHub are attributed to Copilot, rather than to any one user.
-   **Built to last**: Shared automations belong to the repository, so they keep running if the person who created them leaves the team. Change history lets your team see how the tools, triggers, and prompt have evolved.

For shared automations to run in an organization-owned repository, an administrator must enable the “Allow use of Copilot cloud agent billed to the organization” policy.

<a id="archive-heading-2"></a>

## [Create a shared automation](#archive-heading-2)

When you create an automation on github.com, the GitHub Copilot app , or Visual Studio Code, choose **Shared** under **Type**. You can’t change an automation’s type after you create it. To learn more, see [personal and shared automations](https://docs.github.com/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/about-automations?utm_source=shared-workflows-changelog-docs&utm_medium=changelog&utm_campaign=universe-2026#personal-and-shared-automations).

Shared Copilot Automations are rolling out to users on Copilot Pro, Pro+, Max, Business, and Enterprise plans. Availability may vary as the rollout progresses. Once available, you can create automations in any repository where you have write access.

Join the discussion within [GitHub Community](https://github.com/orgs/community/discussions/211004?utm_source=shared-workflows-changelog-community-discussion&utm_medium=changelog&utm_campaign=universe-2026).
