> [!NOTE]
> TUI is under active development. APIs may change.

<p align="center">
  <img alt="Ollama" height="200" src="https://github.com/ai-action/assets/blob/master/logos/ollama.svg?raw=true">
</p>

# Code Ollama

[![NPM](https://nodei.co/npm/code-ollama.svg)](https://www.npmjs.com/package/code-ollama)

[![NPM version](https://img.shields.io/npm/v/code-ollama.svg)](https://www.npmjs.com/package/code-ollama)
[![build](https://github.com/ai-action/code-ollama/actions/workflows/build.yml/badge.svg)](https://github.com/ai-action/code-ollama/actions/workflows/build.yml)
[![codecov](https://codecov.io/gh/ai-action/code-ollama/graph/badge.svg?token=gRGUasRn2k)](https://codecov.io/gh/ai-action/code-ollama)

🦙 [Ollama](https://ollama.com/) coding agent that runs in your terminal. Read the [documentation](https://github.com/ai-action/code-ollama/tree/master/docs).

## Prerequisites

Set up [Ollama](https://github.com/ai-action/code-ollama/blob/master/docs/ollama.md).

## Quick Start

```sh
npx code-ollama
```

## Install

Install the [CLI](https://www.npmjs.com/package/code-ollama) globally:

```sh
npm install --global code-ollama
```

## Download

Standalone executables for Linux, macOS, and Windows are also available from [GitHub Releases](https://github.com/ai-action/code-ollama/releases). Extract the archive for your operating system and architecture, then run `code-ollama` (or `code-ollama.exe` on Windows).

> [!WARNING]
> OAuth authentication for MCP servers is not supported in standalone executables. Install the npm package when OAuth-backed MCP servers are required.

## Usage

Open the interactive interface (TUI):

```sh
code-ollama
```

You can also use the `collama` alias:

```sh
collama
```

Check whether the configuration, Ollama connection, and selected model are ready:

```sh
code-ollama doctor
```

Run a one-off prompt:

```sh
code-ollama run gemma4 "Explain the package.json scripts"
```

For non-interactive use in a workspace you trust, pass `--trust` to save the current directory as trusted and skip the confirmation prompt:

```sh
code-ollama run --trust gemma4 "Explain the package.json scripts"
```

## Documentation

- **Getting started:** [Ollama](https://github.com/ai-action/code-ollama/blob/master/docs/ollama.md), [TUI](https://github.com/ai-action/code-ollama/blob/master/docs/tui.md), and [CLI](https://github.com/ai-action/code-ollama/blob/master/docs/cli.md)
- **Features:** [MCP](https://github.com/ai-action/code-ollama/blob/master/docs/mcp.md), [Skills](https://github.com/ai-action/code-ollama/blob/master/docs/skills.md), [Memory](https://github.com/ai-action/code-ollama/blob/master/docs/memory.md), [Sessions](https://github.com/ai-action/code-ollama/blob/master/docs/sessions.md), and [Web Search](https://github.com/ai-action/code-ollama/blob/master/docs/web-search.md)
- **Reference:** [Configuration](https://github.com/ai-action/code-ollama/blob/master/docs/configuration.md)

## License

[MIT](https://github.com/ai-action/code-ollama/blob/master/LICENSE)
