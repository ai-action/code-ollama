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

🦙 [Ollama](https://ollama.com/) coding agent that runs in your terminal. Read the [wiki](https://github.com/ai-action/code-ollama/wiki).

## Prerequisites

Set up [Ollama](https://github.com/ai-action/code-ollama/wiki/Ollama).

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

### TUI

Open the TUI:

```sh
code-ollama
```

Or use the alias:

```sh
collama
```

### Skills

Skills are Markdown instructions loaded into the system prompt as context. They do not add tools or execute code.

Add project skills:

```sh
.code-ollama/skills/<skill-name>/SKILL.md
```

Add user skills:

```sh
~/.code-ollama/skills/<skill-name>/SKILL.md
```

Project skills load before user skills. Missing directories are ignored, and skills with the same directory name from both locations are both loaded with their source labels. Use `/skills` in the TUI to show loaded skills.

See example skill [.code-ollama/skills/git-commit-staged/SKILL.md](https://github.com/ai-action/code-ollama/blob/master/.code-ollama/skills/git-commit-staged/SKILL.md).

### MCP

Tools and resources can be loaded from [Model Context Protocol](https://modelcontextprotocol.io/) servers configured in `~/.code-ollama/config.json`.

Add a stdio server that runs a local command:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

Code Ollama also supports Streamable HTTP servers with headers or OAuth authentication. Permissions control which modes can use server tools, which tools skip approval, and which tools are blocked. Use `/mcp` in the TUI to reload the configuration and inspect servers, tools, resources, permissions, and errors.

See the [MCP wiki guide](https://github.com/ai-action/code-ollama/wiki/MCP) for configuration examples and troubleshooting.

### CLI

Show the version:

```sh
code-ollama --version
```

Show the help:

```sh
code-ollama --help
```

Check whether the configuration, Ollama connection, and selected model are ready:

```sh
code-ollama doctor
```

Run a one-off prompt:

```sh
# code-ollama run --trust <model> <prompt>
code-ollama run --trust gemma4 "review diff"
```

Attach one or more images to a prompt:

```sh
code-ollama run gemma4 "Describe this" --image screenshot.png
```

```sh
code-ollama run gemma4 "Compare these" \
  --image before.png \
  --image after.png
```

## License

[MIT](https://github.com/ai-action/code-ollama/blob/master/LICENSE)
