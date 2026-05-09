# Changelog

## [0.8.0](https://github.com/ai-action/code-ollama/compare/v0.7.0...v0.8.0) (2026-05-09)


### Features

* **Chat:** interrupt agent execution with Ctrl+C or Esc key ([60f56ae](https://github.com/ai-action/code-ollama/commit/60f56ae54bcabbb7174d94eb6cf09ca838fc4246))


### Bug Fixes

* **Chat:** don't ask for tool call after rejection ([0aea77c](https://github.com/ai-action/code-ollama/commit/0aea77cf66870ea68a4752ebd8c591db93984fb1))
* **Chat:** don't show turn aborted message ([a007bd5](https://github.com/ai-action/code-ollama/commit/a007bd5853fbd81572b4d35171a22a9ef4aa42a2))

## [0.7.0](https://github.com/ai-action/code-ollama/compare/v0.6.1...v0.7.0) (2026-05-08)


### Features

* **command:** add `/exit` that exits the tui ([6a74a12](https://github.com/ai-action/code-ollama/commit/6a74a12c834a28dc921fbeb66fbe58836bdf2a53))

## [0.6.1](https://github.com/ai-action/code-ollama/compare/v0.6.0...v0.6.1) (2026-05-08)


### Bug Fixes

* **Chat:** make Enter key behave the same as Tab key for FileSuggestions ([8f07da8](https://github.com/ai-action/code-ollama/commit/8f07da885f3fb9416cd441ea2fff78a3794f031c))

## [0.6.0](https://github.com/ai-action/code-ollama/compare/v0.5.0...v0.6.0) (2026-05-08)


### Features

* **Chat:** add FileSuggestions to Input with `@` mention ([ae35cec](https://github.com/ai-action/code-ollama/commit/ae35cec79b239737dd453cd8b68a310776cdcde8))
* **Chat:** add Input placeholder ([981711b](https://github.com/ai-action/code-ollama/commit/981711b252bbf54624dd2bb4428abec8ceb80160))
* **Chat:** use Ctrl+C to clear dirty Input ([692042a](https://github.com/ai-action/code-ollama/commit/692042a472a4189ca8e2434b6d23f5c8b817f07c))

## [0.5.0](https://github.com/ai-action/code-ollama/compare/v0.4.0...v0.5.0) (2026-05-07)


### Features

* **Chat:** show CommandMenu below Input when slash command is typed ([f76c6d8](https://github.com/ai-action/code-ollama/commit/f76c6d819b4eb4596fcce3c9d5e25e11038254d6))

## [0.4.0](https://github.com/ai-action/code-ollama/compare/v0.3.1...v0.4.0) (2026-05-07)


### Features

* **command:** add `/clear` that resets chat session and tui ([8a6147c](https://github.com/ai-action/code-ollama/commit/8a6147c23957de88e91628c577ce854f55011051))


### Bug Fixes

* **agents:** reset system message after `/clear` command ([5635427](https://github.com/ai-action/code-ollama/commit/5635427b00d979c145eb80293def7a663a2ff6e8))
* **tui:** keep header and footer after clear ([2aca452](https://github.com/ai-action/code-ollama/commit/2aca452f8c0f06a931005603aa141a6002a82ecd))
* **tui:** raise ink maxFps to 60 to stop flickering ([0da7a75](https://github.com/ai-action/code-ollama/commit/0da7a752cc19669a48c3a5b39ef7cb403c36e1e9))
* **tui:** remove `alternateScreen` to bring back terminal scrollback ([e73c35f](https://github.com/ai-action/code-ollama/commit/e73c35fe46b4a86cd176b5de625c240553254b3c))
* **tui:** remove duplicate cursor from `/clear` command ([66a323c](https://github.com/ai-action/code-ollama/commit/66a323c8788e16c6e06cc52fc9975d7618250787))
* **tui:** use ink's screen clear and render in alternate screen ([cbffb2c](https://github.com/ai-action/code-ollama/commit/cbffb2c4290e4136f1837b1750e55a6bbae92bf3))


### Performance Improvements

* **Chat:** reduce render churn via cache and memo ([0a719e2](https://github.com/ai-action/code-ollama/commit/0a719e23e78f20bd6d5afba59730782fff7f07f1))
* **tui:** enable `incrementalRendering` to prevent flicker ([8127347](https://github.com/ai-action/code-ollama/commit/812734739247b72a6828d14b0268ec59da2eea24))

## [0.3.1](https://github.com/ai-action/code-ollama/compare/v0.3.0...v0.3.1) (2026-05-07)


### Bug Fixes

* **ModelPicker:** close select prompt if current model is chosen ([92d6f47](https://github.com/ai-action/code-ollama/commit/92d6f47fd17907c8b3c22cd4afc2357e8d3087a7))
* **ModelPicker:** show current model at the top of the select options ([eb75012](https://github.com/ai-action/code-ollama/commit/eb75012463d8eec0580d0669a1426c0024a6d028))

## [0.3.0](https://github.com/ai-action/code-ollama/compare/v0.2.1...v0.3.0) (2026-05-06)


### Features

* **tui:** add plan mode ([e04eef2](https://github.com/ai-action/code-ollama/commit/e04eef28b55ba1a68efdf0a54c27b82e5846547a))


### Bug Fixes

* **Chat:** check if plan is executable before showing PlanApproval ([8d4ecfe](https://github.com/ai-action/code-ollama/commit/8d4ecfe8627c330f43953adacd12d10877f155ec))
* **Chat:** prevent destructive tools in plan mode ([f4c57f8](https://github.com/ai-action/code-ollama/commit/f4c57f81f213121bc330c15cde6f3af2132ce4c5))
* **Chat:** remind the agent to display a checklist plan when blocked ([6838916](https://github.com/ai-action/code-ollama/commit/6838916053f5d684cddf7aa28a4897e88de387e4))
* **Chat:** stop representing a blocked call as an ordinary tool result ([dd6400f](https://github.com/ai-action/code-ollama/commit/dd6400fbdf55c498bcd713f50fcce4b27db0847d))

## [0.2.1](https://github.com/ai-action/code-ollama/compare/v0.2.0...v0.2.1) (2026-05-06)


### Bug Fixes

* **tui:** stabilize chat input rendering ([f7bdabd](https://github.com/ai-action/code-ollama/commit/f7bdabd96893537dea768e4f56a1a1621c769dba))


### Performance Improvements

* **tui:** don't regenerate command suggestions in chat input ([26c28ec](https://github.com/ai-action/code-ollama/commit/26c28ec8cecd68d7dd4dfdb4af514698e2cdd8fb))

## [0.2.0](https://github.com/ai-action/code-ollama/compare/v0.1.1...v0.2.0) (2026-05-05)


### Features

* **tools:** add edit_file tool ([9823cae](https://github.com/ai-action/code-ollama/commit/9823caebc61ebc523ffe1c1cc17dadb24695b623))

## [0.1.1](https://github.com/ai-action/code-ollama/compare/v0.1.0...v0.1.1) (2026-05-05)


### Bug Fixes

* **vite:** bundle cli for npx runtime ([ced56f8](https://github.com/ai-action/code-ollama/commit/ced56f8d9d4c3fccc4393a80cce53e2f4ad2a264))

## 0.1.0 (2026-05-04)

### Features

- **cli:** add command to run a one-off prompt ([7003b62](https://github.com/ai-action/code-ollama/commit/7003b62df3b5e9e8c520e90e486be0c501757748))
- **components:** add ModelPicker ([6113b00](https://github.com/ai-action/code-ollama/commit/6113b00cc0b2c4391b9875cf2c17b39fc65f4c4f))
- **components:** add slash command Autocomplete ([9238893](https://github.com/ai-action/code-ollama/commit/92388938aca15a254bc91c9420db2c03fb24a60d))
- **components:** render cursor block in Autocomplete ([e840f1b](https://github.com/ai-action/code-ollama/commit/e840f1bd174c841d3388ddabe6deddfb4e644b42))
- **components:** style Header ([a62f317](https://github.com/ai-action/code-ollama/commit/a62f31715c41735921ecc5219c8096df16e978ed))
- **utils:** add tool call support ([271aaf7](https://github.com/ai-action/code-ollama/commit/271aaf78521ef7cb5d35ec6bf731f88bd1636715))
- **utils:** implement static and dynamic system prompt ([6d14a32](https://github.com/ai-action/code-ollama/commit/6d14a322fdc25350d0f63d814a111ad0ee1a89dc))
- **utils:** integrate ollama to Chat ([0458526](https://github.com/ai-action/code-ollama/commit/045852647e0646c7714ef2ab908b8ab36787d451))
- **utils:** save and load config ([09188ff](https://github.com/ai-action/code-ollama/commit/09188ff04fe425ce6bf9e3eb868e6d8104472653))

### Bug Fixes

- **cli:** fix entrypoint guard so binary executes ([227f4af](https://github.com/ai-action/code-ollama/commit/227f4af421051f5753355dc7939d85c806eec359))
- **cli:** lazy-load TUI for packaged commands ([36ae24d](https://github.com/ai-action/code-ollama/commit/36ae24dca0faaf26e0039cfd911c34de5fa32f1b))
- **components:** display mode at bottom of Chat ([5586635](https://github.com/ai-action/code-ollama/commit/558663519f799bf9dcdce21cfc6b41006a112962))
- **components:** don't render system message in Chat ([8dd75cf](https://github.com/ai-action/code-ollama/commit/8dd75cfe949ad87df933aebcd501aa048c54d302))

### Performance Improvements

- **utils:** update grepSearch in tools to try ripgrep ([0542d3d](https://github.com/ai-action/code-ollama/commit/0542d3d4d525c03dfa5fedba3a272fbe55446ac2))
