![Chat in Copilot app showing the Copilot Fusion toggle, provider set to Windows ML, and model selected as MAI Code 1.1 Flash](https://github.blog/wp-content/uploads/2026/10/683227131-ff9c8359-3251-49c7-84a8-13f52ec697e9.png?resize=2064%2C948)

Today we are shipping intelligent routing for local models into experimental preview. [GitHub Copilot Fusion](https://docs.github.com/copilot/concepts/models/copilot-fusion?utm_source=linking-local-model-routing-changelog-fusion-docs&utm_medium=changelog&utm_campaign=universe-2026) can now choose between supported on-device models and cloud models, enabling intelligent local model routing in GitHub Copilot CLI, GitHub Copilot app, and Visual Studio Code. This opt-in experimental preview lets you use your device’s compute without switching models manually for each request. For a deeper dive into this feature, see [our original announcement on October 7th](https://commandline.microsoft.com/local-models-sandboxed-tools-github-windows/).

![Copilot CLI showing the download for MAI Code 1.1 Flash including system requirements and the model picker](https://github.com/user-attachments/assets/7354fffe-0d3f-45ba-9e06-3da91a56144a)

<a id="archive-heading-1"></a>

## [Managed download and setup on Windows](#archive-heading-1)

On supported Windows devices, you can download and configure **MAI Code 1.1 Flash** through the Windows ML provider.

![Copilot app settings showing MAI Code 1.1 Flash downloading and the provider options for bringing your own model](https://github.com/user-attachments/assets/4c777c61-b3ca-459e-960b-c376902637e5)

-   **In Copilot CLI**, enable experimental mode and open `/model` to follow the setup prompts.
-   **In the Copilot app**, configure the Windows ML provider under **Settings > Model providers**, enable **Local model auto routing** under **Settings > Experiments**, and start a new session. **Windows ML local models** is enabled by default on Windows.
-   **In VS Code**, enable `chat.copilot.localModel.enabled`.

Once the model is ready, select **Standard** in **Copilot Fusion** to let Copilot choose between local and cloud models. You can also select the local model directly for your session.

<a id="archive-heading-2"></a>

## [Bring your own local model](#archive-heading-2)

The managed download experience is Windows-only, but Copilot CLI’s local Copilot Fusion routing also works with manually configured models on Windows, macOS, and Linux.

You can configure **MAI Code 1.1 Flash** or **Qwen3.8 Flash Next** through a local OpenAI-compatible server. You manage the model download and inference runtime, and your device must have sufficient resources to run it. Configure the model as a supported local-model provider, enable experimental local routing, and select **Standard** in **Copilot Fusion** to let Copilot choose between eligible local and cloud models.

This builds on the [recent local-model discovery improvements in Copilot CLI](https://github.blog/changelog/2026-10-07-discover-local-models-in-github-copilot-cli/). Adding or discovering a model through bring your own key (BYOK) configuration doesn’t automatically make it eligible for Copilot Fusion.

The Copilot app also supports connecting and directly selecting compatible local models through BYOK. However, its intelligent routing currently supports managed Windows ML models only.

Local inference doesn’t make your session offline. Copilot Fusion still makes routing decisions in the cloud, and local models may have different safety protections from Copilot-provided cloud models.

For setup instructions, see [Adding LLM models to GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli/customize-copilot/add-llm-models?utm_source=local-model-routing-changelog-links-add-llm-models-cli-docs&utm_medium=changelog&utm_campaign=universe-2026) and [Adding LLM models to the GitHub Copilot app](https://docs.github.com/copilot/how-tos/github-copilot-app/add-llm-models?utm_source=linking-local-model-routing-changelog-add-llm-models-app&utm_medium=changelog&utm_campaign=universe-2026). For routing behavior, see [our docs on intelligent routing to local models](https://docs.github.com/copilot/concepts/models/auto-model-selection?utm_source=local-model-routing-changelog-linking-auto-model-selection&utm_medium=changelog&utm_campaign=universe-2026#auto-selecting-local-models).
