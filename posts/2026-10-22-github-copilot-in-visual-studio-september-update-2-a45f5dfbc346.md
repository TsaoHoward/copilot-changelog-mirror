September 2026 brought deeper visibility into your work: explore pull requests without leaving chat, bring the AI model your team trusts, and fix vulnerable packages the moment Visual Studio flags them.

<a id="archive-heading-1"></a>

## [Highlights](#archive-heading-1)

Here’s what’s new with GitHub Copilot in Visual Studio 2026. Check the Insiders channel for the latest:

-   **Explore pull requests with the Git agent**: The Git agent can now explore a pull request for you. Open GitHub Copilot Chat, select the Git agent, and attach a pull request as context from the Git Repository window to get a summary with navigable links to the underlying comments and files. This functionality requires connecting your Git provider’s MCP servers; GitHub and Azure DevOps are both supported.
-   **Updates to Bring Your Own Model (BYOM)**: BYOM is available in preview and lets you use the models your team prefers, through GitHub Copilot or your own model deployments, whether or not you’re signed in to GitHub. This feature is on by default across the Community, Professional, and Enterprise editions. **Breaking change:** BYOM now requires the new Agent (Preview), built on the GitHub Copilot SDK-powered harness. The previous Ask and Agent modes no longer support BYOM, and you’ll need to re-add previously configured Ollama models after updating. Supported providers include Microsoft Foundry, OpenAI, Anthropic, and Ollama.
-   **Fix NuGet Vulnerabilities from the Error List**: NuGet Audit warnings in the Error List now include a fixer action that opens GitHub Copilot Chat in agent mode and asks Copilot to fix the vulnerable packages using the NuGet MCP server. This functionality requires signing in to GitHub Copilot and enabling the NuGet MCP server from the Copilot Chat tools menu.

This update is available to users on all [GitHub Copilot plans](https://docs.github.com/copilot/get-started/plans), including Copilot Free, Student, Pro, Pro+, Max, Business, and Enterprise.

[Download Visual Studio 2026](https://visualstudio.microsoft.com/downloads) to experience all the new Copilot features today. To learn more about what’s new, check out the [Visual Studio blog](https://devblogs.microsoft.com/visualstudio/visual-studio-september-update-power-your-workflow-with-your-model) and [release notes](https://learn.microsoft.com/visualstudio/releases/2026/release-notes).

<a id="archive-heading-2"></a>

## [What’s next for Copilot in Visual Studio](#archive-heading-2)

Stay up to date on the latest Copilot features by following the [Visual Studio blog](https://devblogs.microsoft.com/visualstudio), where you’ll find roadmap updates and opportunities to share feedback.
