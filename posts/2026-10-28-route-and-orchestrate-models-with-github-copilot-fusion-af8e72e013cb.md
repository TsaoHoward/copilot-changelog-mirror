![A GitHub Copilot prompt composer with the Copilot Fusion settings menu open. Fusion is enabled, and the effort-level options are Standard, High, and Max; Max is selected.](https://github.blog/wp-content/uploads/2026/11/683297831-90d4b889-b7d4-4473-93fc-e75bb8595652.png?resize=2064%2C1056)

GitHub Copilot Fusion is generally available. Instead of picking a model for each task, choose Copilot Fusion and let Copilot intelligently route and orchestrate which models it uses for you.

Copilot Fusion brings together [Project HydraFusion’s](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/) multi-model orchestration and [Copilot auto model selection’s](https://docs.github.com/copilot/concepts/models/auto-model-selection) fine-tuned model selection, leveraging the benefits of both to balance performance and cost efficiency.

Since Project HydraFusion launched, we’ve improved its performance. In the Artificial Analysis Coding Agent Index, Copilot Fusion Max scored 60, within two points of Claude Code with Opus 5.5 Max. It delivered that result at about half the average API cost per task, using about half as many tokens and taking about 40% less time per task.

<a id="archive-heading-1"></a>

## [Smarter choices for developers](#archive-heading-1)

When you select Copilot Fusion in the model picker, you aren’t selecting a specific model. You’re choosing a system that routes and orchestrates models for each task. There’s no need to switch models during a task or decide which model suits each step. For each prompt, Copilot Fusion determines which models to use and how they work together, while you choose the right level of effort.

To use it, select **Copilot Fusion** in the model picker, then choose the effort level.

-   **Fusion Standard:** Prioritizes versatile models for everyday coding.
-   **Fusion High:** Prioritizes capable models for challenging tasks and deeper reasoning.
-   **Fusion Max:** Prioritizes the most capable models for the most demanding tasks and complex reasoning.

Watch as Copilot Fusion analyzes each task and selects a model to complete it, orchestrating multiple models through the following workflows when needed.

-   **Single:** One model solves the task directly.
-   **Cascade:** An efficient model drafts a response. A quality check determines whether to accept it or escalate to a stronger model.
-   **Critique:** One model drafts an initial response, another model reviews it, and the original model revises.

![Diagram titled 'Three execution patterns in Copilot Fusion,' comparing three workflows: Single, where a a primary model uses tools to request an answer; Cascade, where a primary model makes a first pass before a judge model either accepts its result as the answer or escalates to a repair model for a fresh-start answer; and Critique, where a primary model drafts an answer and a read-only critic either approves it as-is or requests a revision by the primary model.](https://github.com/user-attachments/assets/1eeffdb5-0c21-4697-8007-bb6df0e70e8b)

<a id="archive-heading-2"></a>

## [More control for administrators](#archive-heading-2)

Administrators control which models Copilot Fusion can use and whether Copilot Fusion is the default.

-   Copilot Fusion only uses the models that are enabled in your enterprise and organization **model policies**. Enterprise administrators can view what models Copilot Fusion picks from, independently set each model’s effective policy state, and disable models for Copilot Fusion without disabling the model for everyone. See [Manage availability of default models](https://docs.github.com/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-availability-of-default-models#configuring-models-available-for-copilot-fusion).
-   Administrators can set Copilot Fusion, at any effort level, as the **default model** for Copilot users with Enterprise managed settings. To configure settings, see [Enterprise managed settings](https://docs.github.com/copilot/reference/enterprise-administrators/enterprise-managed-settings#fusiontier).

> “GitHub Copilot Fusion Standard has improved token efficiency across AT&T by automatically selecting the right model for the task, reducing unnecessary spend and preserving capacity for higher-value work. Previously, developers would often choose a more powerful model for a complex task and forget to switch back for everyday activities. Copilot Fusion eliminates that friction, optimizing model selection without requiring developers to manage it themselves. We’ve also seen its decision-making improve over time, giving developers greater confidence to focus on their work while Copilot handles model selection.”  
> Hari Pokhrel, Principal Software Engineer, AT&T

<a id="archive-heading-3"></a>

## [Billing](#archive-heading-3)

When you use Copilot Fusion you’re billed for each model it uses, at each model’s standard rate. For a limited time, users on paid Copilot plans will receive a 30% discount on model costs when using Copilot Fusion.

<a id="archive-heading-4"></a>

## [Get started](#archive-heading-4)

Copilot Fusion is available on all Copilot plans in Visual Studio Code, the GitHub Copilot app, GitHub Copilot CLI, and JetBrains IDEs. Support for additional clients is coming soon.

Update your client to try it out. Open the model picker, select **Copilot Fusion**, and choose an effort level.

> Note for research preview participants: if you previously enabled auto, HydraFusion, or HydraFusion Max, your selections will automatically transition to the corresponding Copilot Fusion effort levels.

To learn more, see our documentation on [GitHub Copilot Fusion](https://docs.github.com/copilot/concepts/models/copilot-fusion?utm_source=changelog-docs-link-fusion&utm_medium=changelog&utm_campaign=universe-2026) and share your feedback in the [GitHub Community](https://github.com/orgs/community/discussions/211017?utm_source=changelog-community-discussion-fusion&utm_medium=changelog&utm_campaign=universe-2026).
