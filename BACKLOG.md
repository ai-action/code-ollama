# BACKLOG (DO NOT COMMIT THIS)

- [ ] refactor: improve Chat.tsx
- [ ] feat: find_files, add option `respectGitignore` using ignore dependency

- [ ] feat: task (update_plan tool call)
- [ ] feat: `/plan` create concrete implementation plan with outline `<proposed_plan>` (useful when the client has special rendering support for that tag)

- [ ] feat: Ctrl+T or Ctrl+O for diff expansion
- [ ] refactor: save maxToolTurns (MAX_TOOL_TURNS) in config

- [ ] fix: marginTop 1 between rendered markdown and input
- [ ] feat: check `ollama` binary exists; if not, ask to download

```sh
curl -fsSL https://ollama.com/install.sh | sh
```

- [ ] fix: support drag-and-drop image attachment
  - attachment supports file extensions like pdf
- [ ] fix: attachment tokens render at the current cursor position, not always before the text

codex "implement this UI in React" --image mockup.png

- [ ] feat: auto pull model when using cli run
  - code-ollama run "review" (remove model or use option --model)
- [ ] feat: /host or /server or /config for OLLAMA_HOST

- [ ] feat: queue messages

- [ ] feat: FileSuggestions ignores .gitignore (/settings?)

- [ ] feat: run tools/commands in sandbox
- [ ] feat: prompt to trust and remember directory
- [ ] build: add executables to release (Linux, Mac, Windows)
- [ ] feat: parallel agent calls (multiple concurrent streams sharing state)
- [ ] feat: `/stats` - duration (m s), messages (user, tool calls), context used

- [ ] feat: skills, markdown files in `~/.code-ollama/skills/`
- [ ] feat: mcp servers

```
/mcp

🔌  MCP Tools

  • No MCP tools available.

  • clickup
    • Auth: Unsupported
    • URL: https://mcp.clickup.com/mcp
    • Tools: (none)

  • codex_apps
    • Auth: Bearer token
    • Tools: (none)

  • figma
    • Auth: Unsupported
    • URL: https://mcp.figma.com/mcp
    • Tools: (none)
```

- [ ] feat: show tip

```
  Tip: Use /mcp to list configured MCP tools.
  Tip: New Use /fast to enable our fastest inference with increased plan usage.
```

- [ ] ? for shortcuts

```
  / for commands                             ! for shell commands
  ctrl + j for newline                       tab to submit message
  @ for file paths                           ctrl + v to paste images
  ctrl + g to edit in external editor        esc esc to edit previous message
  ctrl + r search history                    ctrl + c to exit
  ⌥ + , reasoning down                       ⌥ + . reasoning up
  shift + tab to change mode                 ctrl + t to view transcript
```

- [ ] feat: make request with Jina Reader API key
- [ ] Enter/Space to select
- [ ] test: E2E
- [ ] refactor: state management? zustand vs xstate
- [ ] when there's a migration, add "version" to session metadata.json
