---
title: "Discover local models in GitHub Copilot CLI"
source_url: https://github.blog/changelog/2026-10-07-discover-local-models-in-github-copilot-cli
published_at: 2026-10-07T15:46:13+00:00
fetched_at: 2026-10-10T01:47:23.128286+00:00
---

GitHub Copilot CLI makes it easier to choose a local model without leaving your existing workflow. Starting in CLI version 1.0.94-0, use `/model` to discover supported models from a running local Ollama instance, alongside your configured models and cloud models provided by GitHub Copilot.

Discovery doesn’t automatically add models. Choose a discovered model, review its provider and endpoint, then confirm **Add and use for this session** or **Add without switching**. You can use the model in your current session without restarting the CLI. Ollama and the model must already be installed—this flow doesn’t install a runtime or download models. Models must support tool calling and streaming.

Provider connection failures appear in the picker with an explanation, helping you identify what needs attention.

This CLI update builds on the same idea as the GitHub Copilot app’s provider experience: choose the model that fits your work. In the app, add a supported provider in **Settings > Model providers**.

Choosing a local model doesn’t turn on offline mode or disable GitHub telemetry. In the CLI, offline mode remains an explicit choice through `COPILOT_OFFLINE=true`. A remote provider can still receive prompts and code context over the network, even in offline mode. Follow the [CLI provider and offline-mode documentation](https://docs.github.com/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models?utm_source=changelog-cta-byok-model-documentation&utm_medium=changelog&utm_campaign=oct-7-event-oct-2026) for configuration and limits.

We’re also announcing intelligent routing with local models. Read the [announcement on the Microsoft Command Line blog](https://gh.io/localdevelopment) and stay tuned for availability.

Learn more about [setting up your own model provider in the GitHub Copilot app](https://docs.github.com/copilot/how-tos/github-copilot-app/use-byok-models?utm_source=changelog-cta-byok-models-app&utm_medium=changelog&utm_campaign=oct-7-event-oct-2026).
