---
title: "GitHub Copilot can now interact with desktop apps with computer use"
source_url: https://github.blog/changelog/2026-10-01-github-copilot-can-now-interact-with-desktop-apps
published_at: 2026-10-01T19:11:26+00:00
fetched_at: 2026-10-09T02:14:54.383919+00:00
---

Computer use is now available in public preview in GitHub Copilot CLI and the GitHub Copilot app on macOS and Windows.

Copilot can interact with desktop applications on your behalf (e.g., reading accessible app content and visual context, clicking controls, entering and editing text, pressing keys, scrolling, dragging, and navigating workflows across applications). This expands the tasks Copilot can help automate, including workflows in legacy and GUI-only software that do not provide an API, command-line interface, or MCP integration.

<video aria-label="Copilot uses computer-use tools to navigate an expense-report workflow in Safari." autoplay="" controls="" loop="" muted="" src="https://github.com/user-attachments/assets/866a9adf-4b90-4aef-9f92-b21dae47c551" width="100%"><br/>
</video>

Copilot uses computer-use tools to navigate an expense-report workflow in Safari.

You remain in control. Copilot asks for approval before controlling an app, and you can review or reset apps that you have chosen to always allow. On macOS, computer use also guides you through the required Accessibility and Screen Recording permissions. Organization-managed settings can disable the feature.

To get started:

- In Copilot CLI, run `/computer on`. Use `/computer show` to check its status and `/computer off` to disable it.
- In the GitHub Copilot app, open **Settings**, select **Computer Use**, and turn on **Enable Computer Use**. You can also use `/computer on`.

Computer use works best when you describe the outcome you want, the applications involved, and any important constraints. For example, you can ask Copilot to summarize notifications in a browser, update content in a presentation, or move information through a workflow in a desktop application.

Learn more about [computer use in GitHub Copilot CLI and the GitHub Copilot app](https://docs.github.com/copilot/concepts/agents/computer-use)
