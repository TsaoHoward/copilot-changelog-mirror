Enterprise administrators can now use `telemetry` in managed settings to attribute GitHub Copilot activity to a user without collecting their prompts, responses, or tool content.

The `telemetry.capture.identity` setting adds three attributes to OpenTelemetry (OTel) data:

-   `user.name`: The authenticated Copilot account name, currently the GitHub login.
-   `process.user.name`: The local operating-system account.
-   `host.name`: The local machine name.

Identity capture is off by default and remains separate from the existing pseudonymous user identifier. Fine-grained capture controls are available in Copilot CLI, the GitHub Copilot app, and VS Code sessions using Agent Host.

Administrators can also independently control five additional capture classes:

-   `prompts`: User, system, and developer prompts and supported input context.
-   `responses`: Assistant responses and supported reasoning content.
-   `toolArguments`: Raw tool arguments, commands, tool schemas, and identifiers for tools, MCP servers, plugins, and hooks.
-   `toolOutput`: Tool results and execution-error details.
-   `policyDetail`: Raw policy details such as sandbox filesystem paths.

Every capture class is off by default. Explicit managed values take precedence over local settings, SDK configuration, and environment variables. The existing `captureContent` setting remains available as a legacy shorthand for the five content classes, but it never enables identity.

Prompt, tool, and policy capture can include source code, file contents, commands, tool results, and workspace or user-profile paths. Enable only the classes required for your audit use case and send them to an approved collection endpoint.

To learn more, see [the enterprise managed settings reference](https://docs.github.com/copilot/reference/enterprise-administrators/enterprise-managed-settings) and [monitor agent usage with OpenTelemetry](https://code.visualstudio.com/docs/agents/guides/monitoring-agents).

Join the discussion within [GitHub Community](https://github.com/orgs/community/discussions/199139).
