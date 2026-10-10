---
title: "Local sandboxing for GitHub Copilot now generally available"
source_url: https://github.blog/changelog/2026-10-07-local-sandboxing-for-github-copilot-now-generally-available
published_at: 2026-10-07T15:46:17+00:00
fetched_at: 2026-10-10T10:39:31.237089+00:00
---

Local sandboxing for GitHub Copilot is now generally available in GitHub Copilot CLI, the GitHub Copilot app, and VS Code sessions using Agent Host.

Local sandboxes give developers a secure execution boundary for agentic workflows on their own machines. Tools and commands initiated by Copilot run with restricted access to the filesystem, network, credentials, and other system capabilities, based on policies defined by the developer or their organization.

Local sandboxing is powered by [Microsoft eXecution Container (MXC)](https://github.com/microsoft/mxc), which translates a common sandbox policy into native operating-system controls across Windows, macOS, and Linux.

With local sandboxing, developers and organizations can:

- Limit the files and directories that agent-run commands can read or modify.
- Control access to the internet, local networks, Git credentials, and GitHub CLI credentials.
- Apply sandboxing to local tools and services, including local MCP and language servers where supported.
- Use enterprise-managed settings to require sandboxing and enforce policies that developers cannot weaken.
- Adopt more autonomous agent workflows while maintaining clear boundaries around what Copilot can access.

Model execution and tool isolation are separate concerns. Sandbox policies apply to tool execution regardless of which model Copilot uses.

Local sandboxing is included with GitHub Copilot at no additional cost. To get started, see [About cloud and local sandboxes for GitHub Copilot](https://docs.github.com/copilot/concepts/security-governance-and-network-settings/about-cloud-and-local-sandboxes?utm_source=changelog-cta-cloud-local-sandbox-documentation&utm_medium=changelog&utm_campaign=oct-7-event-oct-2026).
