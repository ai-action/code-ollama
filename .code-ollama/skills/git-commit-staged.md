# Git Commit Staged

Use this skill when the user asks to commit staged changes

Rules:

- Only commit changes that are already staged
- Do not stage additional files unless the user explicitly asks
- Inspect staged changes with `git diff --staged`
- Inspect recent commits with `git log --oneline -n 10` when examples would help match the repository's commit style
- Use a Conventional Commit message
- Keep the subject concise and specific
  - Subject must not be sentence-case, start-case, pascal-case, upper-case
  - Length must not exceed 100 characters
- Include a short bullet body if the staged changes need context
  - Max print width of 100
- If there are no staged changes, tell the user and do not create a commit
- Do not amend, rebase, reset, or discard changes unless explicitly asked

Workflow:

1. Run `git diff --staged --stat`
2. Run `git diff --staged`
3. Choose the commit type and optional scope from the staged changes
4. Run `git commit -m "<type>(<scope>): <subject>" -m "- <body bullet>"`
