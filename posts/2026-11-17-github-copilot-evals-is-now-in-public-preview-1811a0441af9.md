![GitHub Copilot Evals icon beside eval results for skills, MCP servers and agents, with passes and failures. A magnifying glass highlights a failed skill run, and its steps show the tool result that failed and the expected versus observed evidence.](https://github.blog/wp-content/uploads/2026/11/708227288-e807f2f1-a3ba-420e-9ce4-fe51b3053550.png?resize=2064%2C1084)

You can now use [GitHub Copilot Evals](https://aka.ms/evals) to optimize GitHub Copilot for yourself. As your prompts, models, skills, and tools change, are you still getting the most out of Copilot? Evals helps you answer that question for the skills, agents, and MCP tools in your setup. Create an eval, inspect how they behave, and use the results to decide what to improve.

<a id="archive-heading-1"></a>

### [What’s an eval?](#archive-heading-1)

An eval is a repeatable test for AI behavior. You give an agent a realistic task, describe what a good result looks like, and check both the result and how the agent got there.

AI output can change from one run to the next, so one good answer doesn’t tell you whether a customization works well for you. After changing a skill, agent, or MCP in your Copilot setup, rerun the same eval to check the behavior you care about and catch regressions.

<a id="archive-heading-2"></a>

### [What you can do](#archive-heading-2)

<video loop="" controls="" autoplay="" muted="" width="100%" src="https://github.com/user-attachments/assets/6e98f7df-128b-4932-b799-2a2c1372a9f9"><br></video>

Ask Copilot in your own words or use the `/eval` command to:

-   **Create an eval** for a skill, custom agent, or MCP tool in your project.
-   **Run it** and see which checks passed and failed. You approve each run before it starts.
-   **Find out why a check failed** and decide what to change in your Copilot setup.
-   **Compare runs** from before and after a customization change to see whether it helped.

GitHub Copilot Evals uses [Vally](https://aka.ms/vally), an extensible local eval tool, as its evaluation engine.

<a id="archive-heading-3"></a>

### [Get started](#archive-heading-3)

Install GitHub Copilot Evals where you already use Copilot:

-   **Visual Studio Code:** Install the [GitHub Copilot Evals extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-evals) from the Visual Studio Marketplace.
-   **Copilot CLI:** Install the GitHub Copilot Evals plugin by following the [installation instructions](https://github.com/github/evals#install).
-   **GitHub Copilot app:** Open **Customize**, add the `github/evals` marketplace, and install the GitHub Copilot Evals plugin.

GitHub Copilot Evals is in public preview for Copilot Individual, Copilot Business, and Copilot Enterprise plans.

To learn more, see the [GitHub Copilot Evals documentation](https://aka.ms/evals). Share feedback by [opening an issue](https://github.com/github/evals/issues) or joining the discussion in [GitHub Community](https://github.com/orgs/community/discussions/categories/copilot-conversations).
