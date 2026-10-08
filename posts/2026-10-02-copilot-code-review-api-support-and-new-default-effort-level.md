---
title: "Copilot code review: API support and new default effort level"
source_url: https://github.blog/changelog/2026-10-02-copilot-code-review-api-support-and-new-default-effort-level
published_at: 2026-10-02T19:13:50+00:00
fetched_at: 2026-10-08T02:00:51.579565+00:00
---

![screenshot of Balanced review effort level default selected in settings](https://github.blog/wp-content/uploads/2026/10/663343489-d0f10d32-3726-4507-9ede-10407ea30715.jpg?resize=2064%2C1096)

You can now request a GitHub Copilot code review through the REST and GraphQL APIs and set the review effort level for each request. **Balanced** is also now the default review effort level. These changes are generally available to Copilot Pro, Pro+, Max, Business, and Enterprise plans.

## 🔌 Request Copilot code review with the API
{: #archive-heading-1 }

You can now request a review from Copilot using the supported REST and GraphQL APIs. When you make a request, you can optionally set the review effort level for that review.

This lets you bring Copilot code review into your own scripts, workflows, and internal tools, so reviews can start from the systems your team already uses.

## ⚖️ Balanced is now the default review effort level
{: #archive-heading-2 }

As announced on August 28, 2026, the **Default** review effort level now uses **Balanced** for new and existing repositories and organizations using Copilot code review. If you explicitly selected **Lite** in your settings, that selection was respected. This change took effect September 28, 2026.

### ⚙️ Configure your review effort level
{: #archive-heading-3 }

If you prefer **Lite** or want to try out the options available to you, you can change the review effort level from **Default** to **Lite** at the level you manage:

- **Enterprise:** In your enterprise settings, go to **AI controls** → **Agents** → **Copilot code review**.
- **Organization:** In your organization settings, go to **Copilot** → **Code review**.
- **Repository:** In your repository settings, go to **Copilot** → **Code review**.
- **Personal:** Click your profile picture, then go to **Copilot settings** → **Copilot** → **Code review**.

Each level can override the one above it. For step-by-step instructions, see [Configuring code review by GitHub Copilot](https://docs.github.com/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review).
