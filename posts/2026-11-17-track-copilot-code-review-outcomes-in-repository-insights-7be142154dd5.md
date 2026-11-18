![Screenshot of two sections of the repository insights dashboard depicting comment addressed rate as a line graph and comment categories as a bar graph](https://github.blog/wp-content/uploads/2026/11/705685743-4fcf08b7-3f2e-4ea7-aa79-75b88b7edc91.png?resize=2064%2C1096)

You can now see how Copilot code review feedback lands in each repository. A new “Repository insights” page, the first item in a repository’s **Insights** tab, brings Copilot code review outcomes together in one place.

<a id="archive-heading-1"></a>

## [What’s new](#archive-heading-1)

Repository insights show four summary signals for each repository:

-   **Comments addressed:** Copilot code review comments that were acted on.
-   **High-severity comments addressed:** High-severity Copilot code review comments that were acted on.
-   **Pull requests with no later human change request:** Pull requests reviewed by Copilot that didn’t receive a later change request from a human reviewer.
-   **Merged pull requests without Copilot review:** Merged pull requests that Copilot code review didn’t review.

You can also explore:

-   **Addressed rate:** The share of evaluable comments that were addressed, with its numerator, denominator, unevaluable exclusions, trend over time, and supported breakdowns.
-   **Comment categories:** The types of feedback Copilot code review leaves in the repository.

The same metrics are also available in the enterprise and organization repository 1-day reports (`repos-1-day`) in the Copilot usage metrics API.

<a id="archive-heading-2"></a>

## [Why this matters](#archive-heading-2)

Repository insights show whether developers act on Copilot code review feedback, whether human reviewers still request changes after Copilot reviews a pull request, and where merged work skips Copilot review entirely. Use these insights to find repositories with coverage gaps and focus enablement where it will have the most impact.

<a id="archive-heading-3"></a>

## [Important notes](#archive-heading-3)

-   You can view Copilot code review outcomes in the Repository insights page if you have read access to the repository.
-   Enterprise owners and billing managers, organization owners, and anyone with a custom organization or enterprise role that grants the `View Copilot Metrics` permission can access the repository 1-day reports through the API.
-   The Copilot usage metrics policy must be enabled to support this functionality.

Visit the [Repository insights documentation](https://docs.github.com/copilot/how-tos/administer-copilot/view-repository-insights?utm_source=repo-insights-changelog-admin-docs&utm_medium=changelog&utm_campaign=ignite-nov-2026) and [Copilot usage metrics API documentation](https://docs.github.com/rest/copilot/copilot-usage-metrics?utm_source=repo-insights-changelog-usage-metrics-docs&utm_medium=changelog&utm_campaign=ignite-nov-2026) to get started.
