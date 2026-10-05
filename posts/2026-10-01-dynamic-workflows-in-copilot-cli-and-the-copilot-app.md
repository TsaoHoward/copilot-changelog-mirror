---
title: "Dynamic workflows in Copilot CLI and the Copilot app"
source_url: https://github.blog/changelog/2026-10-01-dynamic-workflows-in-copilot-cli-and-the-copilot-app
published_at: 2026-10-01T16:30:10+00:00
fetched_at: 2026-10-05T10:05:09.578094+00:00
---

Dynamic workflows are now available in Copilot CLI, the GitHub Copilot app, and the GitHub Copilot SDK. These let you define an orchestration in code to get the reliability and observability that complex, multi-agent work demands.

### [What is a dynamic workflow?](#archive-heading-1)
{: #archive-heading-1 }

A dynamic workflow is a program that defines how a task is carried out. It combines automated steps with the work of one or more agents, and those steps can run one after another, in parallel, or both. The steps, when to involve agents, and how to use their results are all defined in code, while agents handle the parts that need analysis or judgment. The program itself lives inside a GitHub Copilot extension, which means it has access to Copilot’s powerful extensibility APIs.

For example, you could use a dynamic workflow to investigate a service incident: collect logs and telemetry, assign independent agents to analyze different systems, and combine their structured findings into a timeline and root-cause report. The same steps run every time.

Dynamic workflows can:

- Run commands, use tools, or call other services.
- Divide a goal into tasks and run independent tasks in parallel.
- Pass structured results from one stage to the next.
- Have subagents verify each other’s findings.
- Ask you for input, if your client supports it.
- Pause at a checkpoint so you can review results and resume when you’re ready.

Unlike `/fleet`, where Copilot delegates work to subagents and coordinates their work in parallel, a dynamic workflow carries out a process defined in code. Learn more in [our docs about dynamic workflows](https://docs.github.com/copilot/concepts/agents/dynamic-workflows#how-dynamic-workflows-differ-from-autopilot-and-fleet).

You can author dynamic workflows yourself or have Copilot write them for you. Just like with extensions, Copilot includes built-in authoring guidance you can use to learn how dynamic workflows work or to have Copilot write one entirely for you.

### [When to use a dynamic workflow](#archive-heading-2)
{: #archive-heading-2 }

Use a dynamic workflow when you want to define a process you can reuse, or when a single task needs clear stages, checks, or limits. Good candidates include:

- Running release checks, asking one agent to assess failures, and pausing for you to review the findings before resuming.
- Reviewing many changed files in a pull request in parallel.
- Using code to find unresolved review comments on merged pull requests, then asking two models whether the comments still matter. The workflow’s code only reports findings when both agree.
- Sweeping a large codebase for a pattern (e.g., missing tests or usages of an API you’re removing) across many directories at once.
- Researching a change, planning its implementation from the findings, and then making the change.
- Kicking off a long, potentially expensive run that you may want to pause and resume later.

For a quick answer or a simple change, a normal prompt in the standard chat mode is usually sufficient.

### [Get started](#archive-heading-3)
{: #archive-heading-3 }

Dynamic workflows are available on all Copilot plans.

To get started:

- In the GitHub Copilot app, dynamic workflows are always available with no setup required.
- In the latest version of Copilot CLI, enable experimental features by running the CLI with the `--experimental` command-line option or by using `/experimental on` in an interactive session. To update Copilot CLI, run `/update`.
- Ask Copilot to create a workflow for a process you run often. For step-by-step instructions, see [Creating a dynamic workflow](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-dynamic-workflows#creating-a-dynamic-workflow).
- Ask “What dynamic workflows are available?” to see the ones you already have.

Share feedback with `/feedback` in Copilot CLI.

Dynamic workflows are in public preview and subject to change.

Join the discussion within [GitHub Community](https://github.com/orgs/community/discussions/categories/announcements).
