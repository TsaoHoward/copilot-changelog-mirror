![GitHub logo beside JetBrains logo on a green grid background](https://github.blog/wp-content/uploads/2026/11/681948821-44afde3e-3c49-4c63-987d-71f01130280d_f9c37f.png?resize=2064%2C776)

This update brings remote access, on-device voice dictation, and browser use controls to GitHub Copilot for JetBrains. Copilot users in JetBrains IDEs also get context usage shortcuts, historical diffs, simpler follow-up controls, and improvements to chat reliability.

<a id="archive-heading-1"></a>

## [What’s new](#archive-heading-1)

<a id="archive-heading-2"></a>

### [Cloud sandbox (public preview)](#archive-heading-2)

Cloud sandbox runs Copilot sessions in an isolated, GitHub-hosted environment instead of on your computer. Copilot can make code changes and run commands and tests there, freeing local resources and allowing parallel sessions. We’re rolling this out in phases.

![User chooses cloud sandbox from the dropdown and works in the cloud sandbox with Copilot](https://github.com/user-attachments/assets/1bb83780-126a-4969-aa54-6470837f06bb)

<a id="archive-heading-3"></a>

### [Remote access (public preview)](#archive-heading-3)

You can now opt in to remote access to make Copilot chats available in other Copilot clients, such as VS Code and the Copilot app. Discover shared sessions from remotely accessible computers, or reopen remote sessions from history to continue the conversation. We’re rolling this out in phases.

![Remote access to Copilot sessions in JetBrains](https://github.com/user-attachments/assets/d91ab2a0-8231-42e6-9de5-9726cb967c40)

<a id="archive-heading-4"></a>

### [Browser use (public preview)](#archive-heading-4)

Paired with [GitHub Copilot in Chrome](https://chromewebstore.google.com/detail/github-copilot/hblomdgalaelcilcdepgohfcogjiijhe), Copilot’s built-in browser use plugin can open and navigate web pages, read their content, and interact with links, buttons, and forms to gather information or complete web-based tasks.

Enable Browser Use in JetBrains under **GitHub Copilot > Chat > Enable Browser Use**.

![GitHub Copilot extension in Chrome showing it's connected and ready](https://github.com/user-attachments/assets/9110bf45-2ac1-4f53-8dfd-18cf0da7abde)

<a id="archive-heading-5"></a>

### [On-device voice dictation (public preview)](#archive-heading-5)

You can now dictate chat messages on supported native plugin packages with **Editor Preview** enabled. Opt in and download a model to get started. Transcripts stay as editable drafts until you select **Send**.

![Copilot interface showing someone pressing a record button and to use on-device voice dictation and then Copilot spelling out 'create a simple math library' in the chat ](https://github.com/user-attachments/assets/e0d2fdaf-2d6c-4ce6-be3a-61317c2d3e34)

<a id="archive-heading-6"></a>

### [Split mode remote development](#archive-heading-6)

GitHub Copilot supports JetBrains split mode remote development, with chat and editor UI running on your local client while Copilot operations run on the remote backend. Make sure you have the GitHub Copilot plugin installed both locally and on the remote backend.

<a id="archive-heading-7"></a>

## [User experience enhancements](#archive-heading-7)

You can manage conversations and find model options with fewer steps:

-   **Conversation timing**: See timestamps on Copilot agent prompts and responses.
-   **Session cleanup**: Use **Delete** beside **Archive** in session history, and choose whether to skip future single-session deletion confirmations.
-   **Model picker**: Find **Copilot Fusion** pinned at the top of Copilot agent model management, where it stays enabled even when you deselect the entire model group.
-   **Organization usage**: See Copilot Access usage in the quota dialog consistently with other organization plans, including organization help links rather than upgrade or overage actions.
-   **Steer and queue**: Press `Enter` to steer a running Copilot agent session, or `Ctrl+Enter` (`Command+Enter` on macOS) to queue a follow-up.
-   **Inline chat details**: See model names and per-response token details while retaining agent session credit totals. Ask mode response footers now show the selected Fusion tier rather than the underlying model, and the model picker stays open when you turn Copilot Fusion on or off.
-   **Worktree names**: Use shorter Copilot worktree directory and branch names that retain their timestamps.

<a id="archive-heading-8"></a>

## [Quality improvements](#archive-heading-8)

This update improves chat persistence, startup, and recovery, preserves saved history, and fixes proxy-related loading issues and saved Claude Code paths on Unix. You also get clearer error messages for failed tool calls, working historical session diffs on newer JetBrains IDE EAP builds, and improvements to context search, code formatting, input focus, and MCP sign-in recovery.

<a id="archive-heading-9"></a>

## [Changed](#archive-heading-9)

<a id="archive-heading-10"></a>

### [Onboarding and usage tips](#archive-heading-10)

The chat onboarding tour is now generally available to eligible users. Chat usage tips are available by default, while your saved tips preference remains unchanged.

<a id="archive-heading-11"></a>

### [Enterprise-managed providers and Copilot Fusion](#archive-heading-11)

Enterprise-managed settings now disable Claude and Codex unless an administrator policy allows an exception. Copilot preserves your saved provider preferences.

Copilot Fusion now applies enterprise-managed tier defaults while keeping available tiers selectable and preserving your saved choices.

<a id="archive-heading-12"></a>

### [Code review and Java modernization](#archive-heading-12)

Code review now uses the Copilot agent review engine. You still see results in the existing inline review interface.

You can now find Java modernization findings in the “Problems View” on supported IDEs. We’ve restored automatic Maven vulnerability checks: opening or importing a Maven project sends dependency coordinates to GitHub Advisories to check for vulnerabilities.

<a id="archive-heading-13"></a>

## [Deprecation](#archive-heading-13)

Support for JetBrains IDE 2025.2 has ended. Upgrade to 2025.3 or later to continue receiving GitHub Copilot updates. We recommend version 2026.2 or later for the best experience.

<a id="archive-heading-14"></a>

## [Try it out](#archive-heading-14)

We encourage you to try out the [latest version of the GitHub Copilot plugin](https://plugins.jetbrains.com/plugin/17718-github-copilot--your-ai-pair-programmer/versions) and share your feedback. We’d love to hear about your experience in the following channels:

-   In-product feedback: Use the feedback options within your IDE.
-   Feedback repository: Share your thoughts in the [GitHub Copilot for JetBrains IDEs issues](https://github.com/microsoft/copilot-intellij-feedback/issues).
