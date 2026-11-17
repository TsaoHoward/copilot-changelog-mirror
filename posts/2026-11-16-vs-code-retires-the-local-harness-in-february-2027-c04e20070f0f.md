![VS Code retires the Local harness in February 2027](https://github.blog/wp-content/uploads/2026/11/704252268-e600c177-84f0-438a-adfa-2b71cd22ea43.png?resize=1200%2C630)

Visual Studio Code 1.146 deprecates the Local harness, the older software that coordinates the model, context, and tools for GitHub Copilot agent sessions in the editor. The Local harness will be removed in February 2027.

Its replacement, the [Microsoft Copilot harness](https://blogs.microsoft.com/blog/2026/10/28/introducing-the-microsoft-copilot-harness-unlocking-the-potential-of-truly-multi-model-agentic-work/), is built into VS Code and has been the default for new sessions since VS Code 1.143. You can keep working in VS Code and running agent commands on your machine. Choosing the Copilot harness doesn’t move your files to the cloud.

During the three-month transition, the Local harness remains available where your organization’s policy permits. However, new features and improvements will focus on the Copilot harness.

<a id="archive-heading-1"></a>

## [Why use the Copilot harness](#archive-heading-1)

Built on the [Copilot SDK](https://aka.ms/copilot-harness/sdk/repo), the Copilot harness shares its coding-agent runtime with Copilot CLI and the GitHub Copilot app. You can continue the same session between the editor and the Agents window in VS Code while the session’s Agent Host process stays running. Editor-provided tools still require a connected editor.

With the Copilot harness, you can:

-   Let [Copilot Fusion](https://code.visualstudio.com/docs/agent-customization/language-models#_use-copilot-fusion) choose models and, on supported tiers, coordinate drafting and review for your task.
-   Reduce approval interruptions with [assisted permissions](https://code.visualstudio.com/docs/agents/run/approvals#_permission-levels). Calls that are not approved by the risk assessment will still come to you for confirmation.
-   Bring context from your team’s services using [Copilot connectors](https://code.visualstudio.com/docs/agent-customization/copilot-connectors), without configuring MCP servers yourself. Connectors are in preview.
-   Plan work on task boards and explore interactive diagrams with [canvases](https://code.visualstudio.com/docs/agents/run/canvases), which are in preview.

If you access models through GitHub Copilot, you can continue to use your existing plan, including Copilot Free. Individual features and Fusion tiers depend on your plan, settings, and organization policy.

With the Copilot harness, administrators can enforce managed runtime permissions and sandbox restrictions that the Local harness cannot enforce. Configure these controls separately; selecting the Copilot harness doesn’t enable sandboxing.

<a id="archive-heading-2"></a>

## [What you need to do](#archive-heading-2)

If you still use the Local harness, start a new session in VS Code and select **Copilot** under [**Session Target**](https://code.visualstudio.com/docs/agents/run/agent-harnesses#_select-a-harness). [Review your customizations for compatibility](https://code.visualstudio.com/docs/agent-customization/migrate-customizations) before February 2027. Switching harnesses doesn’t automatically convert every customization.

If you administer VS Code, review any `vscode.temporaryDefaultToLocalHarness` exception and verify your required workflows, permission controls, and sandbox configuration with the Copilot harness before February 2027. The temporary enterprise-managed setting will be removed along with the Local harness, so keeping the exception configured won’t keep the Local harness available.

Follow the [Local harness transition guide](https://code.visualstudio.com/docs/agents/run/move-to-copilot). If a workflow blocks your move, [report a VS Code issue](https://code.visualstudio.com/docs/agents/agent-troubleshooting/troubleshooting#_report-an-unresolved-issue).
