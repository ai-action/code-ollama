# Sessions

Sessions preserve conversations so you can leave Code Ollama and continue later. Messages and model usage statistics are saved automatically under `~/.code-ollama`.

## How Sessions Work

Code Ollama creates a session when the TUI starts. The first user prompt becomes the session title, shortened when necessary, and the session's updated time changes as messages are added.

Completed conversation messages are saved automatically. When you exit a non-empty session, Code Ollama prints its resume command:

```sh
code-ollama resume <session-id>
```

Empty sessions are removed automatically when you exit or switch sessions.

Sessions belong to the exact directory where they were created. The session manager only lists sessions for the current working directory, and the resume command rejects a session created in a different directory.

## Manage Sessions

Enter the following command in the TUI:

```
/sessions
```

The session manager provides these actions:

- **New session** starts an empty conversation.
- **Open session** switches to another saved session from the current directory.
- **Delete session** permanently removes another session from the current directory.
- **Close** returns to the current conversation.

Sessions are listed by title and last updated time, with the most recently updated first. The active session is not shown in the Open or Delete lists.

Session titles are generated from the first user prompt and cannot currently be renamed in the TUI.

Deletion from the session manager is immediate and does not have a confirmation step. To delete the active session, first start or open another session.

## Resume from the Command Line

Resume a session directly with the command printed when Code Ollama exits:

```sh
cd path/to/original/project
code-ollama resume <session-id>
```

Run the command from the same directory where the session was created.

To open the session manager at startup, omit the ID:

```sh
code-ollama resume
```

The usual directory trust check still applies before the TUI opens.

## Clear

Use `/clear` to start a new session and clear the terminal display:

```
/clear
```

`/clear` does not delete a previous session that contains messages. You can reopen it later with `/sessions` or its resume command. An empty previous session is removed automatically.

Use `/clear` when starting unrelated work. Use `/compact` when you want to keep working in the same session with a smaller conversation context.

## Compact

Long conversations can consume much of a model's context window. Enter:

```
/compact
```

Code Ollama asks the active model to summarize the conversation, then replaces the saved messages with:

- a system message containing the compacted summary
- the latest user and assistant turn, when available

The session ID and cumulative statistics are retained. Compaction itself is a model call and is included in `/stats`.

Compaction permanently rewrites the session's saved message history and cannot run while another action, plan review, or tool approval is pending. Start a new session instead if you need to preserve the full transcript.

## Statistics

Enter `/stats` to show model usage for the current session:

```
/stats
```

The view includes:

- model call count
- input and output tokens
- total Ollama time
- per-model totals when more than one model was used
- timing, token counts, and token rates for the latest call

Statistics are cumulative for the session and remain after compaction. They describe Ollama usage, not API billing.

## Storage

Each session has a directory under:

```
~/.code-ollama/sessions/<session-id>/
```

Its files are:

```sh
metadata.json   # title, model, timestamps, and working directory
messages.jsonl  # saved conversation messages
stats.json      # cumulative model usage, created after model calls
```

These files are local plain text and can contain prompts, responses, and tool output. They are not added to the project or committed to Git. Do not include secrets in a conversation unless you are comfortable storing them in the session and sending them to the configured Ollama host.

## Troubleshooting

- Run `code-ollama resume` from the original working directory if a session is missing from `/sessions`.
- Use the exact ID printed by Code Ollama when resuming directly.
- A missing or invalid `stats.json` is treated as an empty statistics record.
- Invalid metadata or message data can prevent a session from appearing or opening.
- Back up a session directory before manually editing its files.
- Use `/clear` rather than deleting files manually when you only want a fresh conversation.
