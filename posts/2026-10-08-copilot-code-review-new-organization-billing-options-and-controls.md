---
title: "Copilot code review: New organization billing options and controls"
source_url: https://github.blog/changelog/2026-10-08-copilot-code-review-new-organization-billing-options-and-controls
published_at: 2026-10-08T19:43:05+00:00
fetched_at: 2026-10-10T01:47:20.612138+00:00
---

![screenshot of direct organization billing setting](https://github.blog/wp-content/uploads/2026/10/668966362-bb458e43-d921-45cb-9ac9-28887dc16759.jpg?resize=2064%2C1096)

This release adds new billing and license controls for Copilot code review admins:

- **Billing:** Organization owners can bill Copilot code reviews from members with a Copilot license to the organization’s cost center instead of using up those members’ Copilot quotas.
- **Review request controls:** Organization owners and repository admins can control whether people with external licenses can request a review.

## 💳 Choose how members with a Copilot license are billed
{: #archive-heading-1 }

By default, Copilot code review bills requests associated with members who have a Copilot license to that member’s own Copilot entitlement. Organization owners can now choose to bill the organization that owns the repository instead in order to avoid consuming or exhausting member quotas.

The `Choose how members with a Copilot license are billed` setting has two options:

- **Member** (default): Bills the member’s own Copilot entitlement. If the member’s quota is exhausted, the code review fails.
- **Organization**: Bills the organization that owns the repository. This requires AI Credits paid usage to be enabled for the organization, and you can optionally set a budget.

You can find the setting in your organization settings, under **Copilot** -> **Policies**.

## 🔒 Control who can request a review
{: #archive-heading-2 }

By default, anyone with a paid Copilot license can use it to request a review from Copilot in the repositories they have access to. Organization owners and repository admins can now, if desired, turn on the `Only allow Copilot code review to be triggered by authorized users` setting to require that review requests come from people with a Copilot license provided by your organization or enterprise. When it’s on, people can’t use a Copilot license from outside your organization or enterprise (e.g., a personal license) to request a review. If you turn it on at the organization level, repository admins can’t turn it off.

For details on how the setting applies to personal repositories, automatic reviews, and API requests, see [Reviews requested with an external Copilot license](https://docs.github.com/copilot/concepts/agents/code-review#reviews-requested-with-an-external-copilot-license).
