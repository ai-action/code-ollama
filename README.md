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

## Quick Start

```sh
npx code-ollama
```

> [!IMPORTANT]
> If you see an error that says server/model is unavailable, then follow these [steps](https://github.com/ai-action/code-ollama/wiki/Ollama).

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
# code-ollama run <model> <prompt>
code-ollama run gemma4 "review diff"
```

## License

[MIT](https://github.com/ai-action/code-ollama/blob/master/LICENSE)
