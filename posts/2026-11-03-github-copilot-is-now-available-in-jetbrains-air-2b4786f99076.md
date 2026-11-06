You can now delegate coding tasks, guide execution, and review results with GitHub Copilot in [JetBrains Air](https://www.jetbrains.com/air/). The integration uses the [Agent Client Protocol (ACP)](https://www.jetbrains.com/acp/) and supports tasks in your JetBrains IDE or in the cloud.

Use Copilot in Air alongside the [GitHub Copilot plugin](https://plugins.jetbrains.com/plugin/17718-github-copilot) and choose the workflow that works best for you. For a comparison and FAQ, see [GitHub Copilot in JetBrains Air](https://aka.ms/ghcp/jetbrains/air).

<a id="archive-heading-1"></a>

## [What’s new](#archive-heading-1)

-   **GitHub Copilot in Air’s agent picker**: Select **GitHub Copilot** and use your existing Copilot subscription for coding tasks.
-   **Parallel work and in-context review**: Track multiple agent sessions, use project context and IDE tools, and review changes alongside your code.
-   **Cloud tasks on your GitHub Copilot subscription**: Run Copilot in isolated cloud environments through Air Teams, from your IDE or browser. Tasks use your Copilot plan rather than JetBrains AI credits.

<a id="archive-heading-2"></a>

## [Get started](#archive-heading-2)

For local tasks, install [Air in your JetBrains IDE](https://plugins.jetbrains.com/plugin/33314-air-alpha), select **GitHub Copilot**, and connect your GitHub Copilot account.

![JetBrains Air chat composer with a local coding task and GitHub Copilot selected as the agent](https://github.com/user-attachments/assets/6e90fb87-b9d3-451c-bccc-63357929db71)

For cloud tasks, you’ll need a JetBrains account in an Air Teams-enabled business organization, a GitHub Copilot subscription, and Copilot enabled by your Air administrator. There are two ways to run cloud tasks:

-   **Browser**: Open [Air in your browser](https://air.jetbrains.cloud/), connect GitHub under **Settings > VCS Providers**, and create a task. Choose your repository and remote branch, select **GitHub Copilot**, and send your prompt.
-   **IDE**: Use the Air plugin in your JetBrains IDE and select **Cloud** from the environment selector.

<a id="archive-heading-3"></a>

## [Where Copilot cloud tasks run](#archive-heading-3)

When you run a GitHub Copilot cloud task through JetBrains Air, Copilot works in a Docker container on a fresh virtual machine. All traffic passes through a proxy, and no state carries over between tasks. Copilot can build, test, and install packages without modifying your local environment. For more information, see [Cloud agent sandboxing in Air](https://blog.jetbrains.com/air/2026/10/cloud-agent-sandboxing/).

<a id="archive-heading-4"></a>

## [Cloud task considerations](#archive-heading-4)

-   **Subscription checks**: Connecting GitHub Copilot to Air does not request GitHub Copilot permissions. Air may only verify subscription or credit availability when the cloud environment starts. If your subscription or credits are unavailable, the task fails and an error appears in the session.
-   **Plan selection**: You cannot choose whether an individual task uses your personal GitHub Copilot plan or your organization’s plan.
-   **Usage visibility**: Air’s governance and analytics features do not include Copilot usage.
-   **Administrative controls**: Air administrators can disable GitHub Copilot through a governance policy, but cannot set Copilot spending limits within Air.

<a id="archive-heading-5"></a>

## [Share your feedback](#archive-heading-5)

Share your thoughts through in-product feedback, our [feedback repository](https://github.com/microsoft/copilot-intellij-feedback/issues), or the [private survey](https://aka.ms/ghcp-jb-survey).
