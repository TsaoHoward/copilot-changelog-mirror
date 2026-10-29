![The Security extension in the GitHub Copilot app next to a Copilot session, with a canvas showing options to start a security review and view code scanning findings](https://github.blog/wp-content/uploads/2026/11/679056306-3aa8eb70-0db8-486a-8009-572eccef3284.jpg?resize=2064%2C1096)

You can now work through your repository’s GitHub code scanning alerts without leaving the GitHub Copilot app. The new GitHub security extension, now in public preview, lets you find the alerts that matter most and ask Copilot to explain or help fix them.

Until now, fixing a code scanning alert meant switching between the alert on github.com and the code in your editor. With the security extension, you can move from finding an alert to fixing it in one place.

<a id="archive-heading-1"></a>

### [Fix the alerts already in your code](#archive-heading-1)

If you already run code scanning on your repository, the security extension shows its open code scanning alerts:

-   Browse every open code scanning alert, ordered by severity, and use search and filters to narrow the list.
-   Open an alert to see its details and the affected code. You can open the full alert page on github.com when you need more context.
-   Select one or more alerts and ask Copilot to **Explain** or **Fix** them. Copilot only makes fixes in your local working copy and doesn’t commit or push anything. This way you can review and iterate on the changes in the app and push when you’re ready.
-   See linked pull requests on an alert so you know whether someone is already working on a fix.
-   Dismiss alerts you don’t plan to fix. If your organization uses delegated alert dismissal, the extension sends your dismissal for approval.

![The code scanning findings list in the Security extension, showing alerts by severity with Fix and Explain buttons on a selected alert](https://github.com/user-attachments/assets/998394bd-4bce-4779-866e-f52939fac045)

<a id="archive-heading-2"></a>

### [Catch new issues before you open a pull request](#archive-heading-2)

-   Run `/security-review` on your current changes and see those findings next to your existing alerts.
-   The extension tells you when your code has changed since the last review so you know when to run it again.

You can also ask Copilot about your alerts in chat. Copilot uses the security extension’s tools in the same way as any other tool, following your tool permission settings.

<a id="archive-heading-3"></a>

### [Get started](#archive-heading-3)

To install the security extension:

-   In your terminal run `copilot plugin install github-security@awesome-copilot`.
-   In the GitHub Copilot app, click **Customize**, search for `github-security`, then click **\+ Install**.

The extension is automatically enabled, and you can open the Security canvas from a session for your repository.

The **Explain**, **Fix**, and `/security-review` actions use the model you’ve selected in the app and consume AI credits in the same way as any other prompt. Browsing and dismissing alerts don’t use AI.

The security extension is in public preview on github.com and GitHub Enterprise Cloud with data residency. GitHub Enterprise Server isn’t supported.

-   **With any Copilot plan:** You can install the extension and run `/security-review` on your local changes. For Copilot Business and Copilot Enterprise, an administrator needs to enable the GitHub Copilot app policy, and can use enterprise managed settings to control which plugins developers can install.
-   **With code scanning:** You can see, fix, and dismiss existing alerts for repositories where code scanning is enabled and you have permission to view the alerts. Private repositories need GitHub Code Security for this.

Learn more in the [security extension documentation](https://docs.github.com/copilot/how-tos/github-copilot-app/view-and-fix-security-alerts?utm_source=app-security-extension-changelog-docs&utm_medium=changelog&utm_campaign=universe-2026) and join the discussion in [GitHub Community](https://github.com/orgs/community/discussions/210997?utm_source=app-security-extension-changelog-community-discussion&utm_medium=changelog&utm_campaign=universe-2026).
