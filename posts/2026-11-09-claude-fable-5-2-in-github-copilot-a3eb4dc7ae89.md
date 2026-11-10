![](https://github.blog/wp-content/uploads/2026/11/github-copilot-header-3.png?resize=2064%2C600)

Claude Fable 5.2, Anthropic’s newest Fable model, is now generally available in GitHub Copilot. You can use it for complex, multistep coding tasks across large codebases. In early testing, Fable 5.2 solved more tasks than Claude Fable 5.1 while using fewer steps and tool calls. It also completed hard tasks that earlier models missed.

Claude Fable 5.2 requires data retention by default to operate Anthropic’s safety classifiers. Zero data retention access is available for certain eligible enterprise customers. Continue reading for more details.

This model is billed at provider list pricing under usage-based billing. See [Models and pricing for GitHub Copilot](https://docs.github.com/copilot/reference/copilot-billing/models-and-pricing) for details.

<a id="archive-heading-1"></a>

### [Availability in GitHub Copilot](#archive-heading-1)

Claude Fable 5.2 is available to Copilot Pro+, Max, Business, and Enterprise users. You can select the model in the model picker in:

-   Visual Studio Code
-   Visual Studio
-   Copilot CLI
-   GitHub Copilot coding agent
-   GitHub Copilot app
-   github.com
-   GitHub Mobile on iOS and Android
-   JetBrains IDEs
-   Xcode
-   Eclipse

Rollout will be gradual. Check back soon if you don’t see it yet.

<a id="archive-heading-2"></a>

### [Enabling access](#archive-heading-2)

Copilot Enterprise and Copilot Business plan administrators must enable the Claude Fable 5.2 policy in Copilot settings. The policy is off by default.

**Claude Fable 5.2 requires data retention by default.** When Claude Fable 5.2 is used, Anthropic retains data, including prompts and outputs, to operate safety classifiers that detect harmful use. Retained data is not used to train Anthropic’s models. Other Claude models, except for Fable 5, Fable 5.1, and Fable 5.2, continue to operate under zero data retention (ZDR).

To learn more, see [Anthropic’s data retention practices for Mythos-class models](https://support.claude.com/articles/15425996-data-retention-practices-for-mythos-class-models). Enabling the Claude Fable 5.2 policy constitutes acknowledgment of this requirement. Leaving it off keeps Claude Fable 5.2 unavailable to your organization.

<a id="archive-heading-3"></a>

### [Zero data retention access for eligible enterprises](#archive-heading-3)

Eligible customers can use Claude Fable 5.2, Claude Fable 5.1, and Claude Fable 5 with zero data retention through the end of the calendar year under a time-bound exemption while Anthropic rolls out Enterprise Frontier Safeguards (EFS). After that point, continued use of the models will require EFS, which will enable automated safety monitoring while also giving eligible customers more options for how their data is retained. This includes the option to use storage and encryption keys under their own control. Between now and then we will be working with Anthropic to provide feedback on EFS.

If your enterprise is approved for access, Claude Fable 5.2, Fable 5.1, and Fable 5 requests will be routed to zero data retention endpoints when the model is enabled. To learn whether your organization qualifies, contact your GitHub account team. GitHub Support cannot determine eligibility or enable access.

Approval will not automatically enable the models. After approval, a Copilot Enterprise or Copilot Business administrator must still enable the Claude Fable 5.2 policy in Copilot settings.

<a id="archive-heading-4"></a>

### [Learn more](#archive-heading-4)

To explore all models available in GitHub Copilot, see our [documentation on models](https://docs.github.com/copilot/reference/ai-models/supported-models) and get started with Copilot.

<a id="archive-heading-5"></a>

### [Share your feedback](#archive-heading-5)

Join the [GitHub Community](https://github.com/orgs/community/discussions/categories/copilot-conversations) to share your feedback.
