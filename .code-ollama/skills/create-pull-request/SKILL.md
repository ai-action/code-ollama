---
name: Create Pull Request
description: Create a GitHub pull request using the repository's PR template
---

Use this skill when the user asks to open a pull request or create a PR.

## Rules

- Create the PR from the current branch to the default base branch (`master`)
- Use the repository's PR template from `.github/PULL_REQUEST_TEMPLATE.md`
- Fill out the template sections based on the changes being submitted
- Include a clear title following Conventional Commits format: `<type>(<scope>): <subject>`
- Ensure the PR body includes:
  - Motivation for the change
  - Current vs new behavior description
  - Completed checklist items (Conventional Commits, Tests, Documentation)
- Verify the PR was created by checking the returned URL
- Do not create a PR if there are no commits between the current branch and base
- Push the current branch to remote before creating the PR if it hasn't been pushed yet

## Workflow

1. Run `git branch --show-current` to identify the current branch
2. Run `git log --oneline master..HEAD` to see commits to include
3. Run `git diff master..HEAD --stat` to review the scope of changes
4. Run `git diff master..HEAD` to review the actual code changes
5. Run `git push -u origin <current-branch>` if the branch hasn't been pushed
6. Read `.github/PULL_REQUEST_TEMPLATE.md`
7. Run `TMPFILE=$(mktemp /tmp/pr-body.XXXXXX.md)` to create a unique temp file
8. Run `cp .github/PULL_REQUEST_TEMPLATE.md $TMPFILE`
9. Fill out `$TMPFILE` with the change details
10. Run `gh pr create --title "<type>(<scope>): <subject>" --body-file $TMPFILE`
11. Verify the PR URL from the output
12. Run `gh pr view <url>` to confirm the PR details
13. Run `rm $TMPFILE` to clean up the temporary file
