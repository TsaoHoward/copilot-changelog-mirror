![Control where GitHub Copilot customizations come from](https://github.blog/wp-content/uploads/2026/11/703138145-4a20e6e7-211d-42bb-a45e-6a08d2ea3895.jpeg?resize=1200%2C630)

As an enterprise administrator, you can now require selected GitHub Copilot customizations to come from plugins or managed settings, rather than standalone user or project configuration. Combined with marketplace restrictions, this lets you distribute approved MCP tools and canvases through a shared plugin library without disabling those capabilities entirely.

<a id="archive-heading-1"></a>

## [Choose which customizations require plugins](#archive-heading-1)

The `strictPluginOnlyCustomization` managed setting blocks standalone customizations from user and project sources. Eligible plugins and managed settings remain allowed, subject to your other policies.

You can apply the restriction to all five supported categories or select individual ones: skills, custom agents, hooks, MCP servers, and executable Copilot extensions. For example, restrict MCP servers and extensions while leaving skills, agents, and hooks open. Extensions here include executable canvas providers, not VS Code Marketplace extensions.

<a id="archive-heading-2"></a>

## [Combine with your marketplace policies](#archive-heading-2)

Plugin-only does not mean enterprise-managed plugins only, and it isn’t a marketplace allowlist. Pair it with `strictKnownMarketplaces` to restrict eligible marketplace sources. Your existing managed settings can supply marketplace definitions and require or block specific plugins.

Enterprise administrators can configure these controls on GitHub Enterprise Cloud for members with Copilot Business or Copilot Enterprise licenses issued by the enterprise or one of its organizations.

See [managing plugin marketplaces and plugins with enterprise-managed settings](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/manage-plugin-marketplaces-and-plugins) for administrator setup.
