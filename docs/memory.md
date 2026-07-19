# Memory

Memory provides durable, local notes that Code Ollama adds to future model turns. Use it for preferences and project facts that should persist between sessions.

Memory is context for the model, not hard configuration. Keep important build commands, policies, and shared project instructions in `AGENTS.md` when they belong in the repository.

## Scopes

Code Ollama supports two memory scopes:

| Scope       | Use for                                         | Storage                                                   |
| ----------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Global**  | Personal preferences that apply across projects | `~/.code-ollama/memories/global/MEMORY.md`                |
| **Project** | Local notes for the current repository          | `~/.code-ollama/memories/projects/<project-id>/MEMORY.md` |

Global memory loads before project memory. Both are included when they exist.

Project memory is keyed to the normalized `origin` remote when one is configured, so clones of the same repository on one machine share the same local memory. Without an `origin` remote, Code Ollama identifies the project by its Git root path. A `metadata.json` file beside the project memory records the resolved project identity.

Memory stays under `~/.code-ollama`; it is not written into the project or committed to Git.

Memory files are plain text and their contents are sent to the configured Ollama host as model context. Do not use memory to store passwords, API keys, or other secrets.

## Manage Memory

Run Code Ollama from the relevant project directory and enter:

```text
/memory
```

The memory manager provides these actions:

- **Edit project memory**
- **Edit global memory**
- **Delete project memory** when it exists
- **Delete global memory** when it exists

While editing, press Enter to add a new line and `Ctrl+S` to save. Press Escape or `Ctrl+C` to cancel.

Saving an empty memory deletes it. The explicit delete actions ask for confirmation first.

## Examples

Global memory can capture preferences that apply to most of your work:

```md
# Preferences

- Keep explanations concise.
- Use Conventional Commits.
- Ask before adding a new production dependency.
```

Project memory can capture local context that is useful but does not belong in the repository:

```md
# Current Work

- The authentication migration is being completed in phases.
- `src/auth/legacy.ts` remains until existing sessions expire.
- Focus reviews on backward compatibility with stored sessions.
```

Write short, direct notes. Remove stale facts rather than allowing contradictory entries to accumulate.

## Memory, AGENTS.md, or Skills?

| Use                     | Best for                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Memory**              | Local preferences, reminders, and evolving project context that should persist between sessions |
| **`AGENTS.md`**         | Version-controlled project conventions and instructions shared with contributors                |
| **[Skills](skills.md)** | Reusable workflows that apply when a particular kind of task is requested                       |

Avoid copying the same instruction into all three. Use the narrowest place that matches its purpose.

## Loading Limits

For each scope, Code Ollama loads at most the first 200 lines and 25 KiB into the model context. Content beyond either limit remains in the file but is not added to the prompt.

References from `MEMORY.md` to other files are not loaded automatically. Ask Code Ollama to read the referenced file when its contents are needed.

Every loaded note consumes context, so keep memory focused and move detailed procedures into project documentation or a Skill.

## Manual Editing

You can edit the `MEMORY.md` files directly with a text editor. Restart Code Ollama after an external edit so the next conversation begins with the latest content.

Use `/memory` when possible because it displays the exact path for the current global or project memory and refreshes the model context after saving.

## Troubleshooting

- Start Code Ollama from the intended repository before editing project memory.
- Check the path shown by `/memory` if project memory appears to be missing.
- Confirm the repository's `origin` when two clones unexpectedly use different project memories.
- Keep important notes near the beginning of the file so they remain within the loading limits.
- Delete obsolete or sensitive information instead of relying on a later note to override it.
