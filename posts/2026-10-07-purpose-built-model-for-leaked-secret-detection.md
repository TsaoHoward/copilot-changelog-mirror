---
title: "Purpose-built model for leaked secret detection"
source_url: https://github.blog/changelog/2026-10-07-purpose-built-model-for-leaked-secret-detection
published_at: 2026-10-07T16:13:56+00:00
fetched_at: 2026-10-08T02:00:49.857555+00:00
---

Secret protection should keep pace with the way you build software, whether you write code yourself or work with an AI agent. With our new purpose-built model, we’re bringing context-aware detection into more developer workflows to help you catch secrets before they’re exposed.

### [What’s new](#archive-heading-1)
{: #archive-heading-1 }

Today, we’re sharing plans for AI secret detection across secret scanning alerts, push protection, and GitHub Copilot security reviews. These features leverage GitHub’s fine-tuned model for secret detection. It reads surrounding code to identify likely credentials, including passwords without a recognizable token format, without generating code or prose.

Model availability:

- **Customers with AI-detected Password alerts have automatically been upgraded to the new model.**
- **AI-detected secrets in push protection** is available in private preview.
- **AI-based secret scanning with the GitHub Copilot `/security-review` command** for the Copilot CLI and Copilot app available soon in private preview.

### [Billing notice and availability](#archive-heading-2)
{: #archive-heading-2 }

**AI-detected secret alerts will remain included in GHSP and GHAS at no additional charge.** The new opt-in checks for push protection and the security review command will consume GitHub AI Credits.

**We’re sharing their planned billing model ahead of broader availability so you can review access and spending before enabling them.**

This notice applies to the following features:

- AI-detected secrets in push protection for GitHub Secret Protection (GHSP) and GitHub Advanced Security (GHAS)
- AI-based secret scanning with the GitHub Copilot `/security-review` command

AI Credit usage for these opt-in checks will be introduced in the coming weeks.

### [AI-detected alerts remain included with Secret Protection](#archive-heading-3)
{: #archive-heading-3 }

Starting today, existing **AI-detected secret alert scans** will automatically switch to the new model at no additional charge for GHSP and GHAS customers. These scans remain included in GHSP and GHAS, separate from the new credit-consuming checks.

### [AI-detected alerts are coming to GitHub Enterprise Server](#archive-heading-4)
{: #archive-heading-4 }

The model will also bring AI-detected alerts to **GHES 3.23** in public preview. This feature is included with an enterprise’s existing purchase of GHSP and GHAS.

### [AI secret detection in push protection](#archive-heading-5)
{: #archive-heading-5 }

AI push protection checks for unstructured credentials at push time, giving you a chance to remove a secret before it enters repository history. **The feature will be available to customers on GitHub Enterprise Cloud or GitHub Teams with a purchase of GHSP or GHAS.** An administrator must enable it, subject to your organization’s or enterprise’s policies.

The planned AI Credit usage will be billed to the organization that owns the repository. A check can consume credits even if it doesn’t block a push. Outside of user-namespace repositories for enterprise-managed users (EMUs), where usage is attributed to the pusher and apply to the user’s allocated credits, AI Credit usage will be attributed to the organization and will **not** apply to any specific user’s allocated credits. Usage will be listed under AI Credit consumption for the **Secret Protection AI Credits** SKU in your AI usage insights.

Billing begins once your organization opts into the public preview and enables the feature.

### [AI secret checks in GitHub Copilot `/security-review`](#archive-heading-6)
{: #archive-heading-6 }

In a supported Copilot CLI or Copilot App session, use `/security-review` before committing, pushing, or requesting pull request review. It reviews active changes for security vulnerabilities and returns prioritized findings with remediation suggestions.

Developers and coding agents can use the built-in `security-review` specialist, address confirmed findings with the appropriate authorization, and run the review again after fixes. The review is read-only—existing Copilot policies and billing apply.

**Coming soon, GitHub is adding checks from the secret classifier alongside the existing LLM-based review.** You don’t need a GHSP or GHAS license to use these checks. The new checks will consume AI Credits in addition to the review’s existing usage. The billing account for your active Copilot plan will receive this usage, reported under GHSP in your AI usage insights. **Billing begins once you opt into the public preview and enable the feature.**

**The new checks will be off by default.** Running `/security-review` won’t enable them. You must opt in where your plan and policies allow. Agents shouldn’t enable credit-consuming features or change policies or budgets without explicit authorization.

See the [Copilot CLI security-review agent documentation](https://docs.github.com/copilot/concepts/agents/copilot-cli/about-custom-agents#built-in-agents) and [security-review instructions for Copilot App sessions](https://docs.github.com/copilot/how-tos/github-copilot-app/agent-sessions#using-security-review-in-app-sessions).

### [Plans and platforms](#archive-heading-7)
{: #archive-heading-7 }

GitHub hosting plans, GHSP licenses, and Copilot subscriptions are separate. GitHub Enterprise (GHE) includes GitHub Enterprise Cloud (GHEC) and GitHub Enterprise Server (GHES). Copilot Enterprise is a separate Copilot subscription.

| Plan or platform | Eligibility for these updates |
| --- | --- |
| **GitHub Team and GHEC** on github.com | AI push protection requires paid GHSP or GHAS coverage. Public, private, and internal repositories can qualify. |
| **GHEC with data residency** on ghe.com | Copilot Business and Enterprise are supported plans on this platform with the Copilot security review command. AI push protection is planned with paid GHSP/GHAS coverage. |
| **GHES** | The new model is planned for AI-detected alerts in GHES 3.23, at no additional charge with GHSP/GHAS. AI push protection isn’t part of this Server release. The Copilot security review command isn’t part of this Server release. |
| **Individual Copilot plans**: Pro, Pro+, Max, Free, and Student | Eligible for security review checks with the new model, subject to access controls and credit consumption. No GHSP or GHAS license is required. |
| **Copilot Business and Copilot Enterprise** | Eligible for security review checks with the new model on supported platforms, subject to invitation and administrator policies. These subscriptions don’t replace the GHSP license required for AI push protection. |

### [Manage access and spending](#archive-heading-8)
{: #archive-heading-8 }

Organization and enterprise administrators will be able to disable the new capabilities by policy and set budgets for their AI Credit usage. Opting in won’t override those controls. Applicable included credits and any additional paid usage follow your account’s billing policies and limits.

To set a dedicated budget, open **Billing and licensing** and select **Budgets and alerts**. Choose **SKU-level budget**, **Advanced Security** as the product, and **Secret Protection AI Credits** as the SKU. An **all AI Credits budget** can cover multiple credit-consuming SKUs.

Budget alerts alone don’t stop usage. Configure **Stop usage when budget limit is reached** where available if you want a spending cap.

If you’re already using AI push protection in private preview, continued use after this billing change takes effect will consume AI Credits. Disable it beforehand if you don’t want that usage. AI-detected alert scanning remains included at no additional charge.

Before enabling or continuing the new checks, review the eligibility, AI Credit pricing, and billing details above, along with your [budget settings](https://docs.github.com/billing/how-tos/set-up-budgets) and [documentation for usage-based billing](https://docs.github.com/enterprise-cloud@latest/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing).
