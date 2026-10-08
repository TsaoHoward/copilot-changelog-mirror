---
title: "GitHub Copilot in VS Code, September 2026 releases"
source_url: https://github.blog/changelog/2026-10-01-github-copilot-in-vs-code-september-2026-releases
published_at: 2026-10-01T19:09:10+00:00
fetched_at: 2026-10-08T02:00:53.900379+00:00
---

This changelog covers VS Code [v1.136 through v1.140](https://aka.ms/VSCode/Release), shipped throughout September 2026.

September’s releases streamline agent-driven development from implementation through pull request merge. Automations handle repeatable tasks, agent merge helps land changes, and improved session management keeps work organized.

Agents are also more flexible across workspaces, Dev Containers, and apps, while GitHub context helps you collaborate without breaking your flow.

## [Agents window](#archive-heading-1)
{: #archive-heading-1 }

Agents window updates made it easier to automate work, manage sessions, and move changes from implementation to merge.

- **Let HydraFusion coordinate models:** If eligible, enable preview features and select HydraFusion in the model picker to choose models and workflows for your coding tasks automatically. This feature is in research preview.
- **Schedule recurring work:** Use automations to run tasks on an hourly, daily, or weekly schedule or run them on demand. Start from a template or use your own prompt. This feature is in preview.
- **Get pull requests ready to merge:** Enable agent merge in an active session to let the agent handle review feedback, failed checks, merge conflicts, and workflow reruns. This feature is in preview.
- **Create pull requests from agent sessions:** Open the pull request form from a Copilot, Claude, or Codex agent session in the Agents window to review and edit the title and description, choose draft and merge options, and create the pull request.
- **Navigate related chats and sessions:** Agents can now decide to create new chats or sessions. Easily switch to the source chat with the navigation link, or use the sessions list to view all related chats organized in a hierarchical view.
- **Keep completed sessions organized:** Use **Mark as Done** suggestions after a session’s pull requests merge, or configure automatic cleanup to keep your session list manageable. This feature is in preview.
- **See when sessions need attention:** Enable the application badge to surface new results, input requests, and pull request checks on your dock, launcher, or taskbar. This feature is in preview.
- **Start Dev Container sessions from the Agents window:** Select **Use Dev Container** from a local or remote folder’s menu to run an agent session with your project’s configured tools and dependencies, including on SSH, Tunnel, and WSL hosts.

<video autoplay="" controls="" loop="" muted="" src="https://github.com/user-attachments/assets/1eb0ee16-dadd-4a8d-977f-f04a31c01874" width="100%"></video>

## [Workspaces and environments](#archive-heading-2)
{: #archive-heading-2 }

Workspace and environment updates make it easier to continue conversations with the project context agents need.

- **Continue quick chats in a workspace:** Start a general Copilot chat without a workspace, then attach a local folder when you want to make the conversation specific to that project.
- **Continue Codex work across apps:** Pick up a Codex conversation from the ChatGPT app in VS Code and start working on your codebase without copying and pasting context or files.

<video autoplay="" controls="" loop="" muted="" src="https://github.com/user-attachments/assets/d7e09a40-73dd-46be-b1ee-d409431f304c" width="100%"></video>

## [Chat and integrations](#archive-heading-3)
{: #archive-heading-3 }

Chat updates keep agent conversations flowing and make it easier to bring in GitHub context.

- **Keep active chats uninterrupted:** When an agent sends a message to an ongoing chat, it no longer interrupts the active turn.
- **Attach GitHub context to any chat:** Add a GitHub issue or pull request from **Add Context**, or paste its URL into the new-session input.

<video autoplay="" controls="" loop="" muted="" src="https://github.com/user-attachments/assets/721c1d83-f862-4f40-99d4-d9d8f3a52a8d" width="100%"></video>

Browse the full release notes for [VS Code 1.136, 1.137, 1.138, 1.139, and 1.140](https://aka.ms/VSCode/Release) to explore everything that’s new.

Download the latest version of [VS Code](https://code.visualstudio.com) and, as always, happy coding!
