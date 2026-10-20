You can now use the REST API to retrieve and update Copilot model policies for enterprises, enterprise teams, enterprise apps, and organizations.

GET and PATCH endpoints are now generally available for model policies at four levels:

-   Enterprise: `/enterprises/{enterprise}/copilot/model-policies`
-   Enterprise teams: `/enterprises/{enterprise}/teams/{team_slug}/copilot/model-policies`
-   Enterprise apps: `/enterprises/{enterprise}/copilot/apps/model-policies`
-   Organization: `/orgs/{org}/copilot/model-policies`

Together, these endpoints make it easier to manage Copilot model availability across your enterprise. Enterprise policies can delegate model control to organizations in organization mode, or to teams and apps in enterprise teams mode. Reference our documentation on [managing availability of models in your enterprise](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-availability-of-default-models) and our [REST API documentation](https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/ai-controls) to get started.
