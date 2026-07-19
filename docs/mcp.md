# MCP

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers add tools and resources to Code Ollama.

## Configure

Configure MCP servers in `~/.code-ollama/config.json` under `mcpServers`. Merge `mcpServers` with any existing settings in the file. JSON does not support comments.

## Stdio

Stdio servers run a local command. Use `args` to pass command-line arguments:

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

Use `env` to add or override environment variables for the server process:

```json
{
  "mcpServers": {
    "localServer": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

The server also inherits the environment of the Code Ollama process.

## Streamable HTTP

Streamable HTTP servers connect to a remote MCP endpoint:

```json
{
  "mcpServers": {
    "remoteDocs": {
      "url": "https://example.com/mcp"
    }
  }
}
```

Use `headers` when the server requires an API key or bearer token:

```json
{
  "mcpServers": {
    "remoteDocs": {
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer replace-me"
      }
    }
  }
}
```

The configuration file stores headers as plain text. Do not commit credentials or share the file.

## OAuth

HTTP servers can authenticate in the browser with OAuth:

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

OAuth credentials are stored in the operating system credential store. Add `clientId` when the server provides a public client ID:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://example.com/mcp",
      "oauth": {
        "clientId": "replace-me",
        "scopes": "file_read"
      }
    }
  }
}
```

Use `callbackPort` when the server requires a fixed redirect URL such as `http://127.0.0.1:8080/callback`:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://example.com/mcp",
      "oauth": {
        "callbackPort": 8080,
        "scopes": "file_read"
      }
    }
  }
}
```

`headers` and `oauth` are mutually exclusive for the same server. OAuth is not supported in standalone executables, so install the npm package when OAuth-backed servers are required.

## Multiple Servers

Add multiple named servers to the same configuration:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "remoteDocs": {
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer replace-me"
      }
    }
  }
}
```

## Permissions

Permissions control which modes can use a server's tools, which tools skip approval in Safe mode, and which tools are blocked:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "permissions": {
        "allowedModes": ["plan", "safe", "auto"],
        "autoApprove": ["resolve-library-id", "get-library-docs"],
        "deny": []
      }
    }
  }
}
```

- `allowedModes` defaults to `["safe", "auto"]`. Add `"plan"` to expose the server's tools in Plan mode.
- `autoApprove` skips the approval prompt for the listed tools in Safe mode.
- `deny` blocks the listed tools in every mode and takes precedence over `allowedModes` and `autoApprove`.

`autoApprove` and `deny` use the native tool names reported by the MCP server. Code Ollama exposes tools to the model with names such as `mcp__context7__resolve_library_id`.

## Disable

Set `disabled` to `true` to skip a server without deleting its configuration:

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

## Status

Use `/mcp` in the TUI to reload the configuration and inspect:

- loaded, disabled, and failed servers
- transport and OAuth status
- loaded tools and permissions
- configuration warnings and startup errors
- server resources

Use the arrow keys and Enter to preview a resource. Press Escape to close the preview or return to chat.

## Troubleshooting

- Run `code-ollama doctor` to check that `~/.code-ollama/config.json` contains valid JSON.
- Use `/mcp` to reload the configuration and view errors for each server.
- Check that stdio commands are installed and available in the environment that launches Code Ollama.
- Check the endpoint, headers, and network connection when an HTTP server fails.
- Complete browser authentication when an OAuth server shows `needs login`.
- Remove `headers` when using `oauth`, and configure either `url` or `command`, not both.
- Use the native tool names shown by the server when configuring `autoApprove` or `deny`.
