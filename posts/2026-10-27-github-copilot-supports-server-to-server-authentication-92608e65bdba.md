GitHub Copilot now supports server-to-server authentication for GitHub Apps installed on organizations, available in public preview. Services and agents built with the GitHub Copilot SDK can now make requests on behalf of an organization without relying on a signed-in user’s credentials. This workload-owned identity helps agents and automated services operate reliably at larger scale without tying their authentication or usage to individual users.

Developers can give a GitHub App the read-only `Copilot Requests` organization permission, install the app on an organization, and pass a short-lived installation access token to the Copilot SDK. Usage is attributed and billed to the organization that owns the installation. The organization’s model policies, budgets, and spending controls apply.

Organization owners can review which apps have access, identify app-attributed usage in AI usage CSV reports using the `app_client_id` field, and stop an app’s access by suspending or uninstalling it.

To get started, see [server-to-server authentication for the GitHub Copilot SDK](https://docs.github.com/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens) and [managing GitHub App access to your organization’s Copilot](https://docs.github.com/copilot/how-tos/administer-copilot/manage-for-organization/manage-app-copilot-access).

![social](https://github.com/user-attachments/assets/fe452e31-b9b4-4b80-b7a7-2a6be38538e0)
