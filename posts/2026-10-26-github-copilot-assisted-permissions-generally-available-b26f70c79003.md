![Chat in GitHub Copilot in VS Code showing Assisted permissions selected out of the different permission modes including manual permissions and allow all. This on top of a green grid background.](https://github.blog/wp-content/uploads/2026/10/682276582-721daad7-9307-4b74-8c93-0280e399cc0b.jpg?resize=2064%2C1096)

Assisted permissions are now generally available in GitHub Copilot CLI, GitHub Copilot app, and Visual Studio Code.

When Copilot requests permission to run a command, access a file system path, or open a URL, a large language model evaluates the request. Requests classified as clearly safe automatically proceed. Other requests require your approval.

<a id="archive-heading-1"></a>

## [GitHub Copilot CLI](#archive-heading-1)

![Copilot CLI showing the /permissions command and the different options including manual, assisted, and allow-all](https://github.com/user-attachments/assets/35c8a739-d736-4270-890a-b1407e4c8e4d)

Run `/permissions`, then select **assisted**.

<a id="archive-heading-2"></a>

## [GitHub Copilot app](#archive-heading-2)

![Mode picker in GitHub Copilot app showing Assisted selected out of the different permission modes including Always ask and Approve all](https://github.com/user-attachments/assets/7f85c711-0af6-431e-bec3-aa8b60359e27)

Open the mode picker, click **Tool permissions**, then select **Assisted**.

<a id="archive-heading-3"></a>

## [Visual Studio Code](#archive-heading-3)

![Chat in GitHub Copilot in VS Code showing Assisted permissions selected out of the different permission modes including manual permissions and allow all](https://github.com/user-attachments/assets/6f180492-3b81-4879-ade7-cd120b48c165)

Open the permissions picker, then select **Assisted permissions**.

<a id="archive-heading-4"></a>

## [Enterprise controls](#archive-heading-4)

If you’re an enterprise administrator, you can use [enterprise-managed settings](https://docs.github.com/enterprise-cloud@latest/copilot/reference/enterprise-administrators/enterprise-managed-settings#permissions) to block **Allow All** while keeping **Assisted** available or disable **Assisted** separately.

You can also choose the default permission mode for new sessions. Developers can still select another mode permitted by policy. If the default is unavailable or prohibited by policy, the session starts with manual approval.

For details about how assisted permissions evaluate requests and when approval is required, see [Allowing safe commands to run without manual approval](https://docs.github.com/copilot/concepts/customizations/allowing-safe-commands).
