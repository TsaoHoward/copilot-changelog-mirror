---
title: "New controls and chat improvements in Copilot for JetBrains"
source_url: https://github.blog/changelog/2026-10-10-new-controls-and-chat-improvements-in-copilot-for-jetbrains
published_at: 2026-10-10T18:53:39+00:00
fetched_at: 2026-10-11T01:02:24.829304+00:00
---

This update brings more control over default models and MCP server in GitHub Copilot for JetBrains. It also makes diagnostics easier to address, improves chat navigation and account controls, and strengthens reliability across agent sessions, customizations, and worktrees.

## [What’s new](#archive-heading-1)
{: #archive-heading-1 }

### [Enterprise-managed default models](#archive-heading-2)
{: #archive-heading-2 }

Enterprise administrators can now use managed settings to choose any available Copilot agent model as the default for new conversations. This gives organizations more control over the starting model while still preserving an explicit model picker choice.

### [Faster fixes from diagnostics](#archive-heading-3)
{: #archive-heading-3 }

Diagnostic intention menus now include a **Fix** action that opens inline chat and asks Copilot to repair the issue. The action uses agent mode when it is available and ask mode otherwise, helping you move from a reported problem to a proposed fix with fewer steps.

### [More control over MCP server startup](#archive-heading-4)
{: #archive-heading-4 }

A new MCP setting lets you disable automatic server startup for Copilot and Claude, giving you more control over when configured tools become active.

## [User experience enhancements](#archive-heading-5)
{: #archive-heading-5 }

This release makes everyday chat, account, and navigation workflows clearer:

- **Account controls**: Signed-in Copilot accounts now have clearer labels, a simpler status display, better navigation for long lists, and a **Switch Account** action.
- **Chat discovery and sign-in**: A one-time reminder helps new users find **Chat**, while the sign-in page has a responsive layout, clearer headings, improved provider choices, a direct Copilot plans link, and cancellable progress during browser authorization.
- **Conversation navigation**: Chat messages are grouped by turn, with controls for moving quickly between turns.
- **Message actions**: User messages now include actions to copy or edit their content.
- **Agent guidance**: The Copilot agent placeholder now highlights questions, edits, context, and commands.
- **Migration flow**: After you accept a migration command, **Go Back** opens a Copilot home session even when you continue the local conversation.

## [Quality improvements](#archive-heading-6)
{: #archive-heading-6 }

This release improves reliability during language server startup, model and provider switching, MCP configuration, customization refreshes, file changes, and worktree workflows. It also resolves interaction and display issues in model management, tool-call details, working sets, and JetBrains IDE settings.

## [Deprecation](#archive-heading-7)
{: #archive-heading-7 }

GitHub Copilot has ended support for JetBrains IDE 2025.1. You now need JetBrains IDE 2025.2 or later to use the plugin.

## [Try it out](#archive-heading-8)
{: #archive-heading-8 }

We encourage you to try out the [latest version of the GitHub Copilot plugin](https://plugins.jetbrains.com/plugin/17718-github-copilot--your-ai-pair-programmer/versions) and share your feedback. Your input is invaluable in helping us refine and improve the product.

## [Share your feedback](#archive-heading-9)
{: #archive-heading-9 }

Your feedback drives improvements. We’d love to hear about your experience in the following channels:

- In-product feedback: Use the feedback options within your IDE.
- Feedback repository: Share your thoughts in the [GitHub Copilot for JetBrains IDEs issues](https://github.com/microsoft/copilot-intellij-feedback/issues).
