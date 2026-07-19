# Configuration

Code Ollama stores user-level settings in:

```text
~/.code-ollama/config.json
```

The file is optional and is created when Code Ollama saves a setting. The smallest valid configuration is an empty JSON object:

```json
{}
```

## Format

The configuration must be a JSON object. Standard JSON rules apply:

- property names and string values use double quotes
- comments are not supported
- trailing commas are not supported
- paths must use valid JSON escaping

Settings managers such as `/models`, `/host`, `/theme`, and `/skills` update this file while preserving other valid top-level settings. Restart Code Ollama after manual edits unless the feature's guide provides a reload action.

## Settings

| Key                  | Type         | Purpose                                            | Details                     |
| -------------------- | ------------ | -------------------------------------------------- | --------------------------- |
| `model`              | string       | Default model used by the interactive interface    | [Ollama](ollama.md)         |
| `host`               | string       | Ollama server URL                                  | [Ollama](ollama.md)         |
| `theme`              | string       | Terminal color theme                               | [TUI](tui.md)               |
| `trustedDirectories` | string array | Workspaces allowed to provide project instructions | [TUI](tui.md)               |
| `mcpServers`         | object       | MCP servers, authentication, and permissions       | [MCP](mcp.md)               |
| `disabledSkills`     | string array | Skills disabled in the manager                     | [Skills](skills.md)         |
| `searxngBaseUrl`     | string       | Optional SearXNG endpoint                          | [Web Search](web-search.md) |

All keys are optional. Use the linked feature page for accepted values, examples, and behavior instead of copying configuration between pages.

Unknown keys are ignored. Check spelling carefully because a valid but misspelled key may not produce an error.

## Precedence

The Ollama host is resolved in this order:

1. `OLLAMA_HOST` environment variable
2. `host` in `config.json`
3. `http://localhost:11434`

The `code-ollama run` command requires its own model argument and does not use or change the saved `model`; see [CLI](cli.md).

Feature-specific settings can have additional defaults and precedence rules documented on their linked pages.

## Validate

Run:

```sh
code-ollama doctor
```

`doctor` confirms that the file contains valid JSON with an object at the top level. It does not fully validate every supported key or nested feature configuration.

For feature-specific validation:

- use `/mcp` to reload MCP configuration and inspect server errors
- use `/skills` to inspect loaded and disabled Skills
- use `/search` to configure and test web search
- use `/host` to configure and test the Ollama server

Fix malformed JSON before changing settings through the interface. Back up the file before making extensive manual changes.

## Security

`config.json` is a local plain-text file. MCP `headers` and `env` values stored in it are not encrypted.

- Do not commit or share the file when it contains credentials.
- Prefer environment-based secret injection for local MCP commands when practical.
- Review `trustedDirectories` and remove workspaces you no longer trust.
- See [MCP](mcp.md) for OAuth credential storage and authentication guidance.
