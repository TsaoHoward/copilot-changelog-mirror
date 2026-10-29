This year, we focused on giving you more choice in how you work with GitHub Copilot in Visual Studio Code: which models you use, where your agents run, and how you stay involved.

Keep work moving without staying at your desk or in one tool. With GitHub Copilot in Visual Studio Code, start a cloud agent session from your phone at standup, steer it from VS Code at your desk, and check on it from github.com at lunch. Session continuity lets you pick up the same session across these clients while your agent keeps working in the cloud.

<a id="archive-heading-1"></a>

### [Start and follow cloud sessions across Copilot clients](#archive-heading-1)

Hand off work without keeping your computer on. Start a cloud agent session from the Agents window in VS Code. The work runs on GitHub’s infrastructure, so closing your laptop doesn’t stop it.

Find and continue the same session in VS Code, the GitHub Copilot app, GitHub Mobile, github.com, or Copilot CLI. Sessions started in a Slack or Microsoft Teams DM can also be continued in these clients.

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/b17fc155-f9a6-468f-b00b-97845acaac95"><br></video>

<a id="archive-heading-2"></a>

### [Keep agents working on your own machines](#archive-heading-2)

Move on to another task or project without worrying about losing your session. The new [Agent Host](https://code.visualstudio.com/docs/agents/concepts/agent-host) isolates your Copilot sessions from individual VS Code windows, so work continues in the background after you close the project folder or window.

You can also run agents on a separate machine while you use your primary development machine for other work. The power and flexibility of VS Code’s Remote SSH and dev tunnels extends to the Agents window. The remote agent works with the same code, tools, and dependencies, and can keep running when you disconnect or quit VS Code locally. The remote machine and its Agent Host must remain running.

![Screenshot of VS Code showing a drop-down menu with the Remote option expanded, displaying Tunnels and SSH.](https://github.com/user-attachments/assets/20f5756c-3edf-472a-85ba-0a0e4083985b)

<a id="archive-heading-3"></a>

### [Move between the editor and Agents windows](#archive-heading-3)

Switch between the editor and the Agents window without starting over. Both views stay in sync with the same live Copilot session.

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/e2f34e59-a797-41c1-a319-a49d127ff241"><br></video>

<a id="archive-heading-4"></a>

### [Control agents on your machine from your phone](#archive-heading-4)

Check progress, give direction, or start a new task on your development machine from GitHub Mobile. Your phone provides the controls, and the agent does the work on your development machine. To get started, open a terminal on that machine and run the VS Code CLI command `code agent host --github-environment` from your project folder. Keep the machine and its Agent Host running while you use it from your phone.

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/c1743f1b-3fb3-47aa-99ad-0d53a9733a09"><br></video>

<a id="archive-heading-5"></a>

### [Get a more consistent GitHub Copilot](#archive-heading-5)

Get more consistent agent behavior across VS Code, Copilot CLI, and the GitHub Copilot app. The Copilot harness, built on the Microsoft Copilot SDK, is now the default for new sessions in both the editor and the Agents window.

![Screenshot showing Copilot selected in the harness picker with a hover description of its Copilot SDK and Agent Host integration.](https://github.com/user-attachments/assets/5aac81b9-be0f-4e6e-8c77-c4a097e294f3)

<a id="archive-heading-6"></a>

### [Install GitHub Copilot CLI with VS Code](#archive-heading-6)

Bring Copilot to your terminal with less setup. Install GitHub Copilot CLI through the VS Code installer on Windows, when adding VS Code to your path on macOS, or by running `copilot` on Linux.

![VS Code Insiders Windows installer setup window, with the Install GitHub Copilot CLI option checked.](https://github.com/user-attachments/assets/880bfc64-8225-41b3-a908-653078039ef5)

<a id="archive-heading-7"></a>

### [Compare model results](#archive-heading-7)

Explore different approaches to the same coding task. Run models and harnesses in parallel in the Agents window, then review their results side by side. You can ask a Judge model to recommend a solution and choose **Synthesize** to combine ideas from the other attempts. This is in preview.

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/79c63fbb-e233-4c3f-9edb-3e57f7cff63e"><br></video>

<a id="archive-heading-8"></a>

### [Let your agent use your desktop apps](#archive-heading-8)

Give your agent tasks that need more than code or terminal commands. With computer use, Copilot can read and interact with desktop apps, including clicking controls and editing text.

On macOS or Windows, open [VS Code Settings](https://code.visualstudio.com/docs/configure/settings#_settings-editor), search for `chat.agentHost.computerUse.enabled`, and enable it. Restart VS Code, then run `/computer on` in a Copilot session running on your computer.

Each application requires your approval. Computer use shares its setup with Copilot CLI and the GitHub Copilot app, so on macOS you grant the required system permissions once. Organizations can disable computer use through policy.

This is an experimental feature.

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/c830395d-6e2b-4554-90ce-f40ae6067857"><br></video>

<a id="archive-heading-9"></a>

### [Build your own client](#archive-heading-9)

Bring session continuity to your own app. Build a client that connects to an Agent Host and works with the same live sessions as VS Code.

The open [Agent Host Protocol (AHP)](https://microsoft.github.io/agent-host-protocol/) lets connected clients stay in sync and catch up after reconnecting. Run `code agent host`, then connect with a client library for TypeScript, Rust, Go, Kotlin, or Swift.

![Animated diagram showing VS Code and a custom app connected to the same Agent Host through the Agent Host Protocol (AHP), sharing live sessions. When the app reconnects, it catches up on missed updates.](https://github.com/user-attachments/assets/f839f535-231e-48f0-aa4d-80504aeaa57b)

<a id="archive-heading-10"></a>

### [Discover marketplace customizations](#archive-heading-10)

Create, discover, and manage agent customizations from one place in VS Code. Open **Customizations** in the Agents window sidebar or run **Chat: Open Customizations**. Its “Browse” page brings together skills, MCP servers, plugins, and other customizations from available sources.

The Customization Marketplace is in preview and enabled by default. Business and Enterprise administrators need to allow **Editor preview features**. Learn more about the [Agent Customizations editor and marketplace](https://code.visualstudio.com/docs/agent-customization/overview).

<a id="archive-heading-11"></a>

### [Strengthen existing plugin and marketplace controls](#archive-heading-11)

Make existing plugin and marketplace controls more reliable. In VS Code, administrators can use policies to require or block named plugins, add marketplaces, and restrict installation to approved sources. Enterprise-managed strict marketplace settings can also turn off built-in marketplaces. Policy-managed plugin toggles are locked in **Customize** > **Plugins**. For controls across Copilot clients, administrators can use [enterprise-managed settings](https://docs.github.com/copilot/reference/enterprise-administrators/enterprise-managed-settings?utm_source=vscode-changelog-enterprise-settings-docs&utm_medium=changelog&utm_campaign=universe-2026).

At the repository level, `.github/copilot/settings.json` can register plugin marketplaces and enable default plugins. These are defaults, not enforcement: contributors can turn plugins off unless enterprise policy requires them. Learn more about [plugin marketplaces and workspace recommendations](https://code.visualstudio.com/docs/agent-customization/agent-plugins).

<a id="archive-heading-12"></a>

### [Connect services with Copilot connectors](#archive-heading-12)

Bring context from services such as Slack, Notion, and Microsoft Learn into agent sessions without installing or managing an MCP server. Connect once from “Browse” and reuse the connection across supported Copilot clients signed in with the same account.

Connectors are in preview, available on all Copilot plans, and work with the Copilot harness. Business and Enterprise administrators need to allow **Editor preview features**. Learn more about [Copilot connectors in VS Code](https://code.visualstudio.com/docs/agent-customization/copilot-connectors).

<a id="archive-heading-13"></a>

### [Learn more](#archive-heading-13)

Learn more in the [VS Code release notes](https://code.visualstudio.com/updates/v1_144), the [Agent Host deep dive](https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture), and [About computer use in GitHub Copilot](https://docs.github.com/copilot/concepts/agents/computer-use?utm_source=vscode-changelog-computer-use-docs&utm_medium=changelog&utm_campaign=universe-2026).

Happy coding! 💙
