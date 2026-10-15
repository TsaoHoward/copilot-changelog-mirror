HydraFusion has an updated model pool, improved orchestration workflows, and introduces HydraFusion Max. Both HydraFusion and HydraFusion Max are available across VS Code, the GitHub Copilot app, and GitHub Copilot CLI and remain in research preview.

HydraFusion orchestrates multiple models to produce a single response, bringing together their strengths so you don’t have to choose an individual model for each task.

<a id="archive-heading-1"></a>

## [What’s new in HydraFusion](#archive-heading-1)

-   **Latest frontier models:** HydraFusion and HydraFusion Max draw from a pool that now includes Claude Opus 5.5, GPT-6 Astra, GPT-6.1 Sol, and GPT-6 Luna. The models used for each task vary based on the orchestration workflow.
-   **Reasoning effort tailored to each step:** Previously, HydraFusion only used each model’s default reasoning effort. With this update, it explicitly tailors effort to each stage, using medium effort for initial drafts and high effort for review. This keeps drafting efficient while dedicating deeper reasoning to checking and improving the work.
-   **Optimized Cascade and Critique workflows:**
    -   **Cascade:** Previously used an initial model to solve the task, with escalation to a stronger model when needed. It can now include a judging step that inspects the initial work and requests a repair only when needed.
    -   **Critique:** Previously relied heavily on text summaries. It now relies more on tools to inspect the actual workspace directly. Critique now also uses parallel critic models to inspect work.

<a id="archive-heading-2"></a>

## [Introducing HydraFusion Max](#archive-heading-2)

HydraFusion Max is built on the same architecture and uses the same workflow techniques as HydraFusion, but is tuned for frontier capability on more demanding tasks. It applies higher reasoning efforts where depth and thoroughness matter most, while still using orchestration to consider token efficiency.

Option

Description

Typical use case

**HydraFusion**

Balanced approach with moderate token savings.

Agentic tasks that require a balance of speed, cost, and performance.

**HydraFusion Max**

Frontier capability for more demanding tasks, with token efficiency considered through orchestration.

Tasks requiring the deepest possible reasoning and most thorough analysis.

Both options are supported across all three clients, so you can access the latest HydraFusion experience whether you work in VS Code, the GitHub Copilot app, or the terminal.

HydraFusion and HydraFusion Max are available on Copilot Pro, Pro+, Business, and Enterprise plans with experimental or preview features enabled, subject to your organization’s model policies.

Learn more in the [HydraFusion documentation](https://docs.github.com/en/early-access/copilot/hydrafusion).

Share your feedback in the [HydraFusion discussion](https://github.com/orgs/community/discussions/206492).
