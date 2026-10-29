![Actions run featuring an agentic workflow created by GitHub Agentic Workflows](https://github.blog/wp-content/uploads/2026/10/605360150-74ec2653-4565-4c79-b467-a9d296725e8f.jpg?resize=2064%2C1016)

[GitHub Agentic Workflows](https://github.github.com/gh-aw/?utm_source=agentic-workflows-changelog-aw-website&utm_medium=changelog&utm_campaign=universe-2026), an open source project from GitHub Next, is now generally available. With agentic workflows, you can automate reasoning-based tasks like issue triage, CI failure analysis, documentation updates, and test writing by using coding agents inside GitHub Actions.

Define your automation in natural language Markdown files, and GitHub Agentic Workflows compiles them into standard Actions YAML. Because these are GitHub Actions, they reuse your existing runner groups and policy constraints. You can use GitHub Copilot or bring your own coding agent to power each workflow.

> We’ve been rolling out our agentic developer workflows, and the results are measurable. One of our leads saved an estimated 29 hours a week on his development work alone. Across his team, measured velocity has more than doubled on average, and AI now authors 91% of the team’s commits. With these workflows, the team cut production errors from about 11,000 a day to under 1,000 and drove a technology migration end to end.
> 
> One workflow takes a feature from requirements to implementation with validation evidence. Others keep our frameworks current and steadily raise code quality and test coverage. Because AI drives the process to completion, our engineers can run four or five efforts in parallel and stay focused on the bigger goals.  
> Ben Alton – Senior manager, Strategy, Architecture & Innovation team at Accenture

<a id="archive-heading-1"></a>

### [Built-in safeguards](#archive-heading-1)

GitHub Agentic Workflows incorporates layered safeguards for your automation. Agents access GitHub content respecting the [integrity filter](https://github.github.io/gh-aw/reference/integrity/) rules, run with read-only permissions by default, and execute inside a sandboxed container behind the [Agent Workflow Firewall](https://github.github.com/gh-aw/introduction/architecture/?utm_source=agentic-workflows-changelog-firewall&utm_medium=changelog&utm_campaign=universe-2026#agent-workflow-firewall-awf). The outputs are validated through the [safe outputs](https://github.github.com/gh-aw/reference/safe-outputs/?utm_source=agentic-workflows-changelog-safe-outputs&utm_medium=changelog&utm_campaign=universe-2026) process, and a dedicated [threat detection](https://github.github.com/gh-aw/reference/threat-detection/?utm_source=agentic-workflows-changelog-threat-detection&utm_medium=changelog&utm_campaign=universe-2026) job scans all proposed changes before they are applied.

<a id="archive-heading-2"></a>

### [Additional capabilities for general availability](#archive-heading-2)

Highlights since the public preview include:

-   **Actions Runner Controller (ARC) and Docker-in-Docker support:** Run agentic workflows on self-hosted ARC runners with Docker-in-Docker.
-   **Improved budget forecasting:** `gh aw forecast` is no longer experimental. It now includes both threat detection credits and monthly ranges for a fuller picture of your AI credit spend.
-   **New models, engine choices, and workflows:** The model inventory has been refreshed, model providers can be picked per workflow, and there are new workflow templates that can be added with `gh aw add-wizard`.
-   **Model routing:** Workflows can use a model router that optimizes for task type and difficulty.
-   **Improved agent isolation:** Agents can run in a Cloud Hypervisor or NVX micro-VM and prevent data leaks in cross-repository workflows with enclaves.

See the [GitHub Agentic Workflows release notes](https://github.com/github/gh-aw/releases) for the full list of changes.

<a id="archive-heading-3"></a>

### [Get started](#archive-heading-3)

Follow the [quickstart guide](https://github.github.com/gh-aw/setup/quick-start/?utm_source=agentic-workflows-changelog-quickstart&utm_medium=changelog&utm_campaign=universe-2026/) to install the CLI extension and trigger your first workflow in minutes. Explore prebuilt workflows in GitHub Next’s [agentics repository](https://github.com/githubnext/agentics?utm_source=agentic-workflows-changelog-agentics&utm_medium=changelog&utm_campaign=universe-2026) for ready-to-use examples covering triage, dependency management, code review, and reporting.

GitHub Agentic Workflows is now generally available on github.com for GitHub Free, Team, and Enterprise. Using the default GitHub Copilot CLI engine to power a workflow requires a Copilot license.

Learn more in the [GitHub Agentic Workflows documentation](https://github.github.com/gh-aw/?utm_source=agentic-workflows-changelog-docs&utm_medium=changelog&utm_campaign=universe-2026), and join the conversation in the [community discussion](https://github.com/orgs/community/discussions/211013?utm_source=agentic-workflows-changelog-community-discussion&utm_medium=changelog&utm_campaign=universe-2026).
