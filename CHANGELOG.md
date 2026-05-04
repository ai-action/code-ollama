# Changelog

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
