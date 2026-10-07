---
title: "Enterprise managed settings in-product validator"
source_url: https://github.blog/changelog/2026-09-25-enterprise-managed-settings-in-product-validator
published_at: 2026-09-25T23:24:57+00:00
fetched_at: 2026-10-07T01:36:59.613323+00:00
---

![Copilot settings validation showing an invalid JSON error and a warning that the enterprise team slug mona-team was not found.](https://github.blog/wp-content/uploads/2026/09/659245945-c9d758e6-af13-46ac-8013-1ac1e2bc87fa.jpeg?resize=2064%2C1096)

You can now use an in-product validator for enterprise managed settings for GitHub Copilot. The validator detects malformed JSON, unsupported configurations, invalid team mappings, and other errors that can prevent policies from being enforced.

Review and correct errors in the “Copilot settings validation” section of the enterprise AI controls page. Each issue identifies the affected file and JSON path, helping you make corrections to ensure that policies are enforced as intended.

Validation covers:

- `copilot/managed-settings.json`
- `copilot/team-mappings.json` and any team settings files referenced by the team mappings file

After correcting an issue, commit the change to the default branch of your `.github-private` repository, reload the Agents page, and review the validator results to confirm that your configuration is valid. To learn more, see our documentation on [enterprise managed client settings](https://docs.github.com/enterprise-cloud@latest/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/get-started#4-validate-and-check-the-settings).
