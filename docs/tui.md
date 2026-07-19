# TUI

The terminal user interface (TUI) is the primary way to use Code Ollama interactively.

## Start

Open Code Ollama from a project directory:

```sh
cd path/to/project
code-ollama
```

You can also use the `collama` alias.

The footer shows the active mode and model. Use `/models` if no model is configured.

## Directory Trust

Code Ollama asks whether you trust a directory before opening the TUI. Project files such as `AGENTS.md` and project skills can become model instructions, so untrusted content could attempt prompt injection.

Continue only when you trust the workspace. Trusted directories are saved in `~/.code-ollama/config.json`.

## Modes

Press `Shift+Tab` to cycle through the execution modes:

| Mode     | Behavior                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| **Safe** | Runs read-only tools automatically and asks before editing files or running commands. This is the default. |
| **Auto** | Runs permitted tools without asking for approval.                                                          |
| **Plan** | Uses read-only tools for research and prepares a plan before making changes.                               |

After Code Ollama creates a plan, choose whether to continue planning or execute it in Safe or Auto mode.

Permissions for [MCP](mcp.md) servers can further control which external tools are available or require approval in each mode.

## Tools

Code Ollama provides tools for:

- reading, listing, finding, and searching project files
- writing, editing, creating, renaming, and deleting paths
- running shell commands
- searching the web and fetching webpages
- calling tools and reading resources from configured MCP servers

In Safe mode, approval prompts show the tool name and arguments before a state-changing tool runs. Choose **Approve tool call** to continue or **Reject tool call** to cancel it. Pressing Escape rejects the tool call.

## Input

Type a prompt and press Enter to submit it.

### Commands

Type `/` to show slash-command suggestions:

| Command     | Description                                  |
| ----------- | -------------------------------------------- |
| `/clear`    | Clear the current session                    |
| `/compact`  | Summarize the conversation and prune context |
| `/stats`    | Show session usage statistics                |
| `/sessions` | Manage sessions                              |
| `/models`   | Manage Ollama models                         |
| `/host`     | Configure the Ollama host                    |
| `/mcp`      | Show MCP server status                       |
| `/memory`   | Manage local memory                          |
| `/skills`   | Show and manage loaded skills                |
| `/theme`    | Change the theme                             |
| `/search`   | Configure web search                         |
| `/exit`     | Exit Code Ollama                             |

Use the arrow keys to highlight a suggestion and press Enter to select it.

### Files

Type `@` followed by part of a filename to search project files:

```text
Explain @src/utils/config.ts
```

Selecting a suggestion inserts the path into the prompt so the model can inspect the relevant file.

### Shell

Prefix input with `!` to run a shell command directly without sending it to the model:

```text
!git status --short
```

Shell escapes execute immediately and do not use the Safe mode tool-approval prompt. Review the command before submitting it.

### Images

Attach an image by:

- pressing `Ctrl+V` when an image is on the clipboard
- dragging an image file into the terminal
- typing or pasting a readable image path

Image prompts require a vision-capable model. Supported formats include AVIF, BMP, GIF, HEIC, HEIF, JPEG, PNG, TIFF, and WebP.

## Message Queue

Submit another text prompt while a model turn is active to queue it. Queued prompts run in order after the current turn finishes.

Press the Up arrow on an empty input to restore the most recently queued prompt for editing. Slash commands, shell escapes, and prompts with images cannot be queued.

## Keyboard Shortcuts

Press `?` to show or hide the shortcuts panel:

| Shortcut      | Action                                 |
| ------------- | -------------------------------------- |
| `Enter`       | Submit the prompt                      |
| `Up` / `Down` | Browse prompt history                  |
| `Ctrl+R`      | Search prompt history                  |
| `Ctrl+V`      | Attach a clipboard image               |
| `Shift+Tab`   | Change mode                            |
| `Ctrl+C`      | Clear input, interrupt a turn, or exit |
| `/`           | Show command suggestions               |
| `@`           | Show file suggestions                  |
| `!`           | Run a shell command directly           |

## Troubleshooting

- Run `code-ollama doctor` when the server or model is unavailable.
- Use `/models` when no model is configured or installed.
- Use `/host` when Code Ollama cannot reach the Ollama server.
- Confirm the active model supports tool calling when it answers without using tools.
- Confirm the active model supports vision when image prompts fail.
- Press `?` to review shortcuts available in the current TUI.
