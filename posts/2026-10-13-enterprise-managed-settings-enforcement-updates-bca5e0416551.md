Enterprise administrators can now require supported GitHub Copilot clients to retrieve current server-managed settings at startup instead of relying on a cached policy. We are also adding minimum client version requirements to governance-focused managed settings keys over time, starting with the `sandbox` key.

<a id="archive-heading-1"></a>

### [Force refresh settings on client startup](#archive-heading-1)

Set `forceRemoteSettingsRefresh` to `true` through server-managed, MDM-managed, or file-based settings when a policy change must take effect before Copilot starts. The setting is supported in Copilot CLI, VS Code, and the GitHub Copilot app.

MDM-managed and file-based delivery can require freshness before the client signs in for the first time. A server-managed value begins requiring refreshes on subsequent startups after the client has received it once. While the setting is active, a cached response cannot satisfy the freshness requirement. If the client cannot confirm current policy, it fails closed rather than running with a stale or unconfirmed policy. Without this setting, clients continue to use the normal managed-settings cache for faster startup and resilience during transient service failures.

<a id="archive-heading-2"></a>

### [Minimum required client version](#archive-heading-2)

We’ve also added enforcement of a [required minimum client version](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings#minimum-client-version-enforcement-for-sandbox) to the `sandbox` key in support of the generally available local sandbox capability. When this key is included in managed settings, users who pin to older versions of Copilot clients will now be forced to update in order to resume using Copilot.

To learn more, see [Deploying enterprise managed settings](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/deploy-managed-settings#requiring-fresh-server-managed-settings-on-startup).

Join the discussion within [GitHub Community](https://github.com/orgs/community/discussions/199139).
