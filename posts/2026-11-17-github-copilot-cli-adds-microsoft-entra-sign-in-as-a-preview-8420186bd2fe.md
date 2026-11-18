![GitHub Copilot CLI adds Microsoft Entra sign-in as a preview](https://github.blog/wp-content/uploads/2026/11/Changelog_NewRelease_MicrosoftEntraCLI.png?resize=2064%2C960)

GitHub Copilot CLI now supports Microsoft Entra authentication in public preview. You can sign in with your Microsoft Entra account to silently authenticate to a linked GitHub Enterprise Managed User (EMU) account, use your Microsoft 365 Copilot license, or both, depending on your organization’s entitlements.

Microsoft Entra authentication for both EMUs and Microsoft 365 Copilot is currently supported on Windows and macOS. Linux support will follow.

<a id="archive-heading-1"></a>

## [Enterprise Managed User support](#archive-heading-1)

For enterprises using [EMUs via OIDC](https://docs.github.com/enterprise-cloud@latest/admin/concepts/identity-and-access-management/enterprise-managed-users?utm_source=cli-microsoft-changelog-emu-docs&utm_medium=changelog&utm_campaign=ignite-nov-2026), GitHub Copilot CLI now supports silent SSO using Microsoft Entra authentication. You can access GitHub from GitHub Copilot CLI using your Microsoft Entra identity without a separate GitHub sign-in. You must have an assigned Copilot Business or Copilot Enterprise license, and your organization must enable the **Copilot CLI** policy. In this scenario, GitHub Copilot CLI uses GitHub inference, and usage is governed by the organization’s GitHub Copilot plan.

This SSO experience is currently limited to GitHub Copilot CLI and VS Code and is available only to enterprises using OIDC for EMU.

To enable Enterprise Managed Authorization for your enterprise on GitHub Enterprise Cloud, see the [Enterprise Managed Authorization documentation](https://docs.github.com/enterprise-cloud@latest/admin/managing-iam/configuring-authentication-for-enterprise-managed-users/about-enterprise-managed-authorization?utm_source=cli-microsoft-changelog-auth-config-docs&utm_medium=changelog&utm_campaign=ignite-nov-2026).

<a id="archive-heading-2"></a>

## [Microsoft 365 Copilot license support](#archive-heading-2)

If your organization is in Frontier and has a Microsoft 365 Copilot license with usage-based billing, Microsoft Entra authentication lets you access models available through Microsoft Copilot directly from the terminal. In this scenario, GitHub Copilot CLI uses Microsoft 365 inference rather than GitHub inference, and you don’t need a GitHub account. Model access and usage limits are managed through your organization’s Microsoft 365 Copilot settings, not GitHub.

You can also use the Work IQ MCP server to give Copilot access to your Microsoft 365 work data as context. For more information, see [the Work IQ MCP overview](https://learn.microsoft.com/microsoft-365/copilot/extensibility/work-iq/mcp/overview).

<a id="archive-heading-3"></a>

## [Get started](#archive-heading-3)

To take advantage of these capabilities, GitHub Copilot CLI version `1.0.113` or later is required. You can update the CLI by running `copilot update` in your terminal.

Steps for enabling each capability in the CLI are provided in the [GitHub Copilot CLI documentation](https://docs.github.com/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli?utm_source=cli-microsoft-changelog-cli-auth-docs&utm_medium=changelog&utm_campaign=ignite-nov-2026).

We’d love to hear about your experience using this new Microsoft Entra support. Join the [GitHub Community](https://github.com/orgs/community/discussions/213386) to share your feedback and help us continue improving the experience.
