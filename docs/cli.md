# CLI

Use these commands to run one-off prompts, check your setup, and resume saved sessions.

> [!NOTE]
> The examples use `code-ollama`. The `collama` alias supports the same commands and options.

## Commands

| Command                            | Description                                            |
| ---------------------------------- | ------------------------------------------------------ |
| `code-ollama`                      | Open the interactive interface; see [TUI](tui.md)      |
| `code-ollama run <model> <prompt>` | Run one prompt and exit                                |
| `code-ollama resume [session-id]`  | Open the session manager or resume a saved session     |
| `code-ollama doctor`               | Check the configuration, Ollama connection, and models |
| `code-ollama --help`               | Show command help                                      |
| `code-ollama --version`            | Show the installed version                             |

## One-off Prompts

Use `run` when you want a non-interactive result:

```sh
code-ollama run <model> "<prompt>"
```

For example:

```sh
code-ollama run gemma4 "Explain the package.json scripts"
```

The model argument is required even when a default model is configured. Running a one-off prompt does not change the configured model, create a session, or save session statistics.

Quote prompts that contain spaces or shell characters.

### Tool Execution

The `run` command loads applicable project instructions, [Memory](memory.md), and [Skills](skills.md). It also exposes built-in tools and permitted [MCP](mcp.md) tools to the model.

> [!WARNING]
> One-off prompts execute tools in Auto mode without approval prompts. A model can edit files or run shell commands in the current project. Review the directory and its instructions before using `run`.

Tool use continues until the model returns a final response or reaches the limit of 25 tool turns.

Run `code-ollama` in Safe mode when you want to approve state-changing tools individually.

### Directory Trust

The first `run` from an untrusted directory asks whether you trust it. Trust is important because `AGENTS.md` and project Skills can become model instructions.

For non-interactive automation, pass `--trust`:

```sh
code-ollama run gemma4 "Review the current diff" --trust
```

`--trust` does more than skip the current prompt: it permanently adds the resolved directory to `trustedDirectories` in `~/.code-ollama/config.json`. Use it only after reviewing the workspace.

### Images

Attach an image with `--image`:

```sh
code-ollama run gemma4 "Describe this screenshot" --image screenshot.png
```

Repeat the option to attach multiple images:

```sh
code-ollama run gemma4 "Compare these screenshots" \
  --image before.png \
  --image after.png
```

Relative image paths are resolved from the current directory. Supported formats are AVIF, BMP, GIF, HEIC, HEIF, JPEG, PNG, TIFF, and WebP. The selected model must support vision.

## Resume Sessions

Open the session manager from the command line:

```sh
code-ollama resume
```

Resume a specific session using the ID printed when Code Ollama exits:

```sh
code-ollama resume <session-id>
```

Run the command from the exact directory where the session was created. See [Sessions](sessions.md) for persistence, storage, compaction, and session management details.

## Doctor

Check whether Code Ollama is ready:

```sh
code-ollama doctor
```

The report shows the Code Ollama and Node.js versions, then checks:

- whether `~/.code-ollama/config.json` contains a JSON object
- the effective Ollama host
- Ollama connectivity, with a three-second timeout
- installed models
- whether the configured model is installed

Warnings such as no installed or configured model do not produce a failing exit status. Invalid configuration, an unreachable server, or a missing configured model exits with status 1. Model checks are skipped when the server is unreachable.

`doctor` does not validate MCP servers, Skills, or web search. Use `/mcp`, `/skills`, or `/search` for those features. See [Ollama](ollama.md) for server and model troubleshooting.

## Help and Version

Show all available commands:

```sh
code-ollama --help
```

Show the installed version:

```sh
code-ollama --version
```

The alias works for subcommands as well:

```sh
collama doctor
```

## Automation Notes

- `run` streams the model response as plain text; it does not provide a JSON output mode.
- `run` requires the prompt as an argument and does not read it from standard input.
- Rejecting the directory trust prompt, command errors, and failed `doctor` checks produce a nonzero exit status.
- `OLLAMA_HOST` overrides the host saved in `~/.code-ollama/config.json`; see [Ollama](ollama.md).
- One-off prompts are not recoverable with `resume` because they do not create sessions.
