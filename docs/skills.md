# Skills

Skills are Markdown instructions loaded into the Code Ollama system prompt. They provide reusable context and workflows, but do not add tools or execute code by themselves.

## Locations

Add project skills to the repository:

```text
.code-ollama/skills/<skill-name>/SKILL.md
```

Add user skills to your home directory:

```text
~/.code-ollama/skills/<skill-name>/SKILL.md
```

Project skills load before user skills. Within each source, skill directories load alphabetically. If project and user directories have the same name, both skills load with their source labels.

## Create

Each skill must have its own directory containing a file named `SKILL.md`:

```text
.code-ollama/
└── skills/
    └── code-review/
        └── SKILL.md
```

Add optional `name` and `description` front matter followed by the instructions:

```md
---
name: Code Review
description: Review changes for correctness, regressions, and missing tests
---

Use this skill when the user asks for a code review.

## Rules

- Inspect the diff before reviewing
- Prioritize correctness and security issues
- Include file and line references for each finding
- Do not edit files unless the user asks for fixes

## Workflow

1. Check the repository status
2. Read the relevant diff and surrounding code
3. Run focused tests when useful
4. Report findings from highest to lowest severity
```

Only `name` and `description` are recognized in the front matter. Both fields are optional. When `name` is omitted, Code Ollama uses the skill directory name.

## How Skills Work

Enabled skills are added to the model's system prompt with their name, source, description, and instructions. The model follows a skill when it applies to the user's request.

Skills cannot add tools or run commands on their own. They can instruct the model to use tools that Code Ollama already provides, subject to the active mode and approval flow.

Every enabled skill consumes context, so keep instructions focused and remove information already covered by the project or system prompt.

## Manage

Use `/skills` in the TUI to open the **Enable/Disable Skills** manager. Selected skills are enabled, and user skills are marked with `*`.

Changes are saved in `~/.code-ollama/config.json` and apply to future model turns. Restart Code Ollama after adding or editing skill files to ensure the latest instructions are loaded.

## Authoring Tips

- State when the skill should be used.
- Keep rules specific and testable.
- Include a workflow when order matters.
- Refer to project commands and conventions instead of repeating general advice.
- Do not claim tools or capabilities that Code Ollama does not provide.
- Review project skills before trusting a repository because their contents become model instructions.

See [`git-commit-staged`](../.code-ollama/skills/git-commit-staged/SKILL.md) for a complete project skill.

## Troubleshooting

- Confirm the file is named `SKILL.md` and is inside its own directory. Flat Markdown files in the `skills` directory are ignored.
- Confirm the project skill path is relative to the directory where Code Ollama was started.
- Restart Code Ollama after creating or editing a skill.
- Check `/skills` to make sure the skill is loaded and enabled.
- Close front matter with `---`. Unclosed front matter is treated as instruction content.
- Check file permissions when a skill is missing. Unreadable files and directories without `SKILL.md` are skipped.
- Expect both copies to load when project and user skill directories share a name.
