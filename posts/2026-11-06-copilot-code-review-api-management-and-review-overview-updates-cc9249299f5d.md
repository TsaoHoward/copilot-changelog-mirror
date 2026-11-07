![screenshot of dropdown on review overview comment with feedback options](https://github.blog/wp-content/uploads/2026/11/698051473-2e089372-9797-400a-a71f-4361f23447cb.jpeg?resize=2064%2C1096)

You can now manage GitHub Copilot code review settings through the REST and GraphQL APIs, from enterprise policy down to individual repositories. Copilot’s review overview comment is now more compact, and this update includes fixes for billing, automatic reviews, and reliability.

These updates are available to Copilot Pro, Pro+, Max, Business, and Enterprise plans.

<a id="archive-heading-1"></a>

## 🔌 Manage settings and identify Copilot’s output through the API

You can already request reviews, choose their effort level, and get information back through the REST API. You can now also:

-   Identify Copilot’s reviews and comments through explicit attribution fields.
-   See the review effort a review used, when that metadata is available.
-   See which skills, MCP servers, and custom instructions Copilot reported as sources for a comment.

Depending on your role, you can also read and update code review settings:

-   Enterprise administrators can enable or disable code review for all organizations, or leave the choice to organization administrators.
-   Organization administrators can manage code review enablement, the default review effort, and the runner configuration. Settings your enterprise manages can’t be overridden.
-   Repository administrators can manage review effort and whether reviews use custom instructions and MCP tools.

The REST API accepts the same review effort levels as the web interface, and organization and repository settings responses list the levels available to you.

⚠️ The enterprise and organization settings endpoints, including the organization runner endpoint, don’t support GitHub Apps or fine-grained personal access tokens. The repository settings endpoints support both, with `Administration: read` permission to read settings and `Administration: write` permission to update them. Classic personal access tokens need repository administrator access.

To get started, see [Configuring Copilot code review with the API](https://docs.github.com/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review#configuring-copilot-code-review-with-the-api).

<a id="archive-heading-2"></a>

## 📋 A more compact review overview

New review overviews keep your findings together at the top:

-   The review effort used and any surveys move into a compact footer.
-   Skipped and content-excluded files share one “Files not reviewed” section, with filenames and linked exclusion reasons.
-   Empty sections are left out, and long lists show an overflow count.

You can also tell us what’s wrong with an overview. After you give it a 👎, choose **Add a reason** and pick the main problem, such as an approval assessment you disagree with, a comment that’s too verbose, or findings that are incorrect or nitpicky. We use this feedback to improve Copilot’s findings.

![Screenshot of Copilot approval comment containing dropdown with feedback reasons for thumbs down](https://github.com/user-attachments/assets/37df4887-33be-491b-8748-2f7953562403)

<a id="archive-heading-3"></a>

## ✨ Other improvements

![screenshot of AI credits being displayed in Copilot code review agent session](https://github.com/user-attachments/assets/efc3400d-3553-4eae-8eff-ecb8e41f147c)

-   Copilot code review agent sessions now show the AI credits consumed in a review.
-   The **Automatically request Copilot code review** repository rule now supports the bypass list, so exempt actors in the list will not receive an automatic review from Copilot.
-   Copilot code review organization and repository settings pages have clearer wording and layout.
-   On later reviews of the same pull request, findings unrelated to your recent changes are collapsed and then hidden.
-   Balanced effort reviews now use three reviewer models, with another model combining their findings.

<a id="archive-heading-4"></a>

## 🐛 Bug fixes

-   Billing and preview settings are now preserved when you turn code review off and on again.
-   Failed or timed-out reviews are retried once automatically, and Copilot can switch to another eligible model when the preferred one is unavailable.
-   GitHub Actions, Dependabot, and apps your organization or enterprise owns can request reviews on bot-authored pull requests again when **Block reviews requested with an external Copilot license** is on, as long as your organization pays for the review.
-   Reviews no longer report a false failure just after starting and discard their results.
-   Reviews in progress during a service update now get more time to finish.
-   Review surveys no longer appear when your organization has opted out of feedback collection.
