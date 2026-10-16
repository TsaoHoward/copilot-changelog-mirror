![A view of a code scanning alert with the title "Uncontrolled command line" in large text at the top. A cursor hovers over an "Assign to Copilot" button in the Assignees section.](https://github.blog/wp-content/uploads/2026/10/667037500-4741169e-5e7b-4ffe-9697-4430fa1220a2.png?resize=2064%2C1022)

Agentic autofix for code scanning alerts is now generally available. It remediates alerts by working across your codebase the way a developer would: it explores relevant files, proposes a fix, and reruns CodeQL to confirm the fix closes the alert before opening a pull request for your review. Agentic autofix is available to GitHub Code Security and GitHub Advanced Security customers on GitHub Enterprise Cloud, including GitHub Enterprise Cloud with data residency.

<a id="archive-heading-1"></a>

## [How it works](#archive-heading-1)

When you assign a code scanning alert to Copilot, it:

-   Explores relevant files across your codebase.
-   Generates a proposed fix.
-   Validates the fix works by rerunning CodeQL.
-   Iterates if needed, then opens a draft pull request ready for your review.

The pull request includes a summary of the fix, why it closes the alert, and the validation steps Copilot took to confirm that it works. When the pull request containing the fix is ready, you can instruct Copilot to make further changes to it by commenting on the pull request or interacting with the session in the **Agents** tab of your repository.

<a id="archive-heading-2"></a>

## [How to use it](#archive-heading-2)

When enabled, agentic autofix replaces the free **Generate Fix** option on individual code scanning alerts with an **Assign to Copilot** button.

You can use agentic autofix:

-   From any code scanning alert on the repository’s default branch, by assigning the alert to Copilot.
-   In the list of security alerts in your repository or security campaign, by selecting up to 25 alerts for Copilot to fix together in a single pull request.
-   Via the [Update a Code Scanning Alert REST API](https://docs.github.com/enterprise-cloud@latest/rest/code-scanning/code-scanning?apiVersion=2026-03-10#update-a-code-scanning-alert) by setting `assignees` to `["copilot-swe-agent[bot]"]`.

Agentic autofix supports code scanning alerts on the repository’s default branch. Alerts detected only on pull requests or other branches cannot be assigned to Copilot.

<a id="archive-heading-3"></a>

## [Access](#archive-heading-3)

Agentic autofix requires an enterprise administrator to enable access to it via the new “Agentic autofix” policy in Advanced Security policies.

Once the policy is enabled by an enterprise administrator, an organization or repository administrator can turn on agentic autofix in the Code Security settings for the organization or the repository.

Access also requires a Copilot billing method to be defined.

<a id="archive-heading-4"></a>

## [Billing](#archive-heading-4)

Agentic autofix for code scanning alerts consumes AI Credits from your Code Security budget and GitHub Actions minutes. AI Credit usage will be displayed in the “AI usage” section of enterprise billing and licensing as the “Advanced Security” product. You can also set SKU level budgets for Code Security AI credits. Learn more about [Copilot usage-based billing](https://docs.github.com/enterprise-cloud@latest/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises).

<a id="archive-heading-5"></a>

## [Learn more](#archive-heading-5)

Learn more about [agentic autofix in the documentation](https://docs.github.com/enterprise-cloud@latest/code-security/concepts/code-scanning/autofix-for-code-scanning).

Join the discussion within the [GitHub Community](https://github.com/orgs/community/discussions/209845).
