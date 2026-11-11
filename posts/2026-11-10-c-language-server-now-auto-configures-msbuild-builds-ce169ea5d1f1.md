The Microsoft C++ Language Server for GitHub Copilot CLI now bundles its MSBuild compile commands extractor and invokes it automatically. An agent no longer needs to discover and run a separate configuration skill before it can get precise code intelligence for your project. For more information, including the installation instructions, see [the main repository page](https://github.com/microsoft/cpp-language-server).

<a id="archive-heading-1"></a>

## [What changed](#archive-heading-1)

Previously, setting up go-to-definition, find references, and other language server features for an MSBuild-based C++ project required you to either provide your own `compile_commands.json` file or Copilot to locate and run a configuration skill before it could generate a compilation database. That extra discovery step added setup time and consumed tokens before Copilot could start working with your code.

Now:

-   The compile commands extractor is bundled directly with the C++ language server, so it’s always available.
-   Copilot invokes the extractor when starting the language server on project open, with no manual or agent-driven setup skill required.
-   Compilation database generation for MSBuild projects is deterministic, reducing setup token usage.

![C++ language server automatically generating compile commands for an MSBuild project](https://github.com/user-attachments/assets/56256011-8c02-4ef1-b572-b0af1007191b)

<a id="archive-heading-2"></a>

## [Configure other build systems](#archive-heading-2)

For other build systems, you can provide your own `compile_commands.json` or use a skill to generate one:

-   For CMake projects, use the generate compile commands skill introduced in [the earlier C++ language server release](https://github.blog/changelog/2026-07-02-new-c-language-server-config-skill-for-copilot-cli/) by asking Copilot CLI to “load project.”
-   For custom build systems, follow the guide to [create a custom build extractor skill](https://github.com/microsoft/cpp-language-server/blob/main/docs/compile-commands.md#other-build-systems).

<a id="archive-heading-3"></a>

## [Get started](#archive-heading-3)

Follow the [Microsoft C++ Language Server quick start](https://github.com/microsoft/cpp-language-server#-quick-start) to install the plugin and accept the EULA. If your repository contains an MSBuild-based C++ project, Copilot will automatically generate the compilation database it needs for accurate code intelligence.

An active GitHub Copilot subscription is required.

Help improve the Microsoft C++ Language Server by completing the [C++ language server survey](https://aka.ms/cpp-lsp-survey). To report a problem or suggest an improvement, [open an issue in the Microsoft C++ Language Server repository](https://github.com/microsoft/cpp-language-server/issues).
