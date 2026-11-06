The enterprise and organization [repository-level Copilot usage metrics](https://github.blog/changelog/2026-07-17-repository-level-github-copilot-usage-metrics-generally-available/) reports now show what happens to Copilot code review feedback. A new `copilot_code_review` object on each `repos-1-day` row reports how many Copilot-reviewed pull requests merged without a later change request from a person and how many Copilot code review comments developers acted on. With these you can track an addressed rate per repository.

<a id="archive-heading-1"></a>

### [What’s new](#archive-heading-1)

-   **`total_comments_evaluated`**: The number of Copilot code review comments checked to see whether the developer acted on them.
-   **`total_comments_addressed`**: The number of evaluated comments the developer acted on, whether by applying the suggestion, asking Copilot to make the fix, editing the code, or replying that the fix will come in a later pull request. Divide by `total_comments_evaluated` for the addressed rate.
-   **`review_comments_by_severity`, `review_comments_by_review_tier`, `review_comments_by_comment_type`, and `review_comments_by_customization`**: Both counts broken down by severity (e.g., `high`, `medium`, `low`), review tier (e.g., `lite`, `balanced`, `max`), comment type (e.g., `bug`, `security`, or `custom` for your repository’s own coding guidelines), and customization (e.g., custom instructions, skills, MCP servers, or none).
-   **`total_merged_no_human_change_request_after_review`**: The number of merged pull requests that Copilot code review reviewed where no person requested changes after Copilot’s first review.

<a id="archive-heading-2"></a>

### [Why this matters](#archive-heading-2)

The existing `pull_requests` fields show how often Copilot code review runs and how often someone clicks to apply a suggestion, but developers act on most feedback in other ways. These fields show whether developers act on Copilot code review feedback in each repository, which kinds of comments land, whether custom instructions, skills, and MCP servers make a difference, and whether reviewers still request changes after Copilot reviews.

<a id="archive-heading-3"></a>

### [Important notes](#archive-heading-3)

-   **Scope:** Present on every row of the enterprise and organization `repos-1-day` reports. Counts are `0` and arrays are empty when a repository had no Copilot code review activity that day.
-   **Counted on merge:** Comments are evaluated when their pull request merges, so they count on the merge day, not the day Copilot posted them.
-   **Bot pull requests:** Copilot usually doesn’t evaluate comments on pull requests opened by bots, such as Copilot cloud agent. `total_merged_no_human_change_request_after_review` still includes those pull requests.
-   **Different from suggestion counts:** `pull_requests.total_copilot_applied_suggestions` counts only ready-to-apply suggestions that someone applied. The new counts include every evaluated comment and count them as addressed however the developer acted on them.
-   **Access:** Enterprise owners, enterprise billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission can access these reports. The Copilot usage metrics policy must be enabled.

Visit the [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics) to get started.
