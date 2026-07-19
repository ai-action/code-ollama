# Ollama

Code Ollama requires an [Ollama](https://ollama.com/) server and at least one installed model.

## Install

Install Ollama on macOS with [Homebrew](https://brew.sh/):

```sh
brew install ollama
```

Install Ollama on Linux:

```sh
curl -fsSL https://ollama.com/install.sh | sh
```

> You can also download Ollama for macOS or Windows from the [official download page](https://ollama.com/download).

Confirm the CLI is installed:

```sh
ollama --version
```

## Start

Start the Ollama server:

```sh
ollama serve
```

The desktop application may already run the server. If Ollama reports that the port is already in use, check whether the application or another `ollama serve` process is running.

Confirm the server is available and list installed models:

```sh
ollama list
```

## Models

Use `/models` in the Code Ollama TUI to download, switch, or delete models.

You can also pull [gemma4](https://ollama.com/library/gemma4) with the Ollama CLI:

```sh
ollama pull gemma4
```

Confirm the model works:

```sh
ollama run gemma4 "Hello, world!"
```

Choose a model that supports tool calling when you want Code Ollama to read files, edit code, or run commands. Image prompts also require a vision-capable model.

## Host

Code Ollama connects to `http://localhost:11434` by default.

Use `/host` in the TUI to configure and test another Ollama server. You can also set `host` in `~/.code-ollama/config.json`:

```json
{
  "host": "http://ollama.example.com:11434"
}
```

Set `OLLAMA_HOST` when launching Code Ollama to override both the default and the saved host:

```sh
OLLAMA_HOST=http://ollama.example.com:11434 code-ollama
```

Remove `OLLAMA_HOST` before using `/host` when the environment variable points to a different server.

## Verify

Check the complete setup:

```sh
code-ollama doctor
```

The command checks:

- `~/.code-ollama/config.json`
- the effective Ollama host
- server connectivity
- installed models
- the selected model

Warnings identify incomplete setup. Failed checks must be fixed before Code Ollama can use the affected server or model.

## Troubleshooting

- **Ollama server unavailable:** Start it with `ollama serve`, open the desktop application, or configure the correct URL with `/host`.
- **Port already in use:** Check whether Ollama is already running before starting another server.
- **No models installed:** Download a model with `/models` or `ollama pull <model>`.
- **No model configured:** Use `/models` to select an installed model.
- **Configured model is missing:** Download the selected model or switch to one that is installed.
- **Unexpected host:** Check `OLLAMA_HOST`; it takes precedence over the saved `host` value.
- **Remote server unreachable:** Confirm the URL, network access, and Ollama server binding on the remote machine.
- **Model download or load fails:** Check available disk space and memory, then try a smaller model.
