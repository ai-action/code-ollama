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

Tools can be loaded from stdio [Model Context Protocol](https://modelcontextprotocol.io/) servers configured in `~/.code-ollama/config.json`.

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

Servers are enabled by default. Skip a server with `disabled: true`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "disabled": true
    }
  }
}
```

MCP tools are exposed to the model with names like `mcp__context7__resolve_library_id` and use the existing tool approval flow. Use `/mcp` in the TUI to inspect configured servers, loaded tools, disabled servers, and startup errors. MCP tools are not available in plan mode.

### CLI

Show the version:

```sh
code-ollama --version
```

Show the help:

```sh
code-ollama --help
```

Run a one-off prompt:

```sh
# code-ollama run --trust <model> <prompt>
code-ollama run --trust gemma4 "review diff"
```

## License

[MIT](https://github.com/ai-action/code-ollama/blob/master/LICENSE)
