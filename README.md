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

Tools can be loaded from [Model Context Protocol](https://modelcontextprotocol.io/) servers configured in `~/.code-ollama/config.json`.

Stdio servers run a local command:

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

Streamable HTTP servers connect to a remote MCP endpoint:

```json
{
  "mcpServers": {
    "remoteDocs": {
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

OAuth-based HTTP servers can authenticate in the browser. OAuth credentials are stored in the operating system credential store:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://example.com/mcp",
      "oauth": {
        "scopes": "file_read"
      }
    }
  }
}
```

Use `oauth.callbackPort` when a server requires a fixed redirect URL such as `http://127.0.0.1:8080/callback`. `headers` and `oauth` are mutually exclusive for the same server.

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

MCP permissions can control which modes may execute server tools, which tools skip approval in **Safe mode**, and which tools are blocked entirely:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "permissions": {
        "allowedModes": ["safe", "auto"],
        "autoApprove": ["resolve-library-id", "get-library-docs"],
        "deny": []
      }
    }
  }
}
```

`allowedModes` defaults to `["safe", "auto"]`; include `"plan"` to allow MCP tools during **Plan mode**. `autoApprove` and `deny` use server-native MCP tool names. `deny` wins over both `allowedModes` and `autoApprove`.

MCP tools are exposed to the model with names like `mcp__context7__resolve_library_id` and use the existing tool approval flow. Use `/mcp` in the TUI to inspect configured servers, loaded tools, disabled servers, permissions, and startup errors. MCP tools are available in **Plan mode** only when `"plan"` is included in `permissions.allowedModes`.

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
