#!/usr/bin/env node

import { realpathSync } from 'node:fs';

import cac from 'cac';

import { PACKAGE, ROLE, SCREEN, UI } from './constants';
import type { Screen } from './types';
import { agents, ollama, screen, session, terminal, tools } from './utils';

interface LaunchOptions {
  sessionId?: string;
  initialScreen?: Screen;
}

const cli = cac('code-ollama');
const MAX_TOOL_TURNS = 25;
const MAX_TOOL_INTENT_CORRECTIONS = 2;

cli.version(PACKAGE.VERSION);
cli.help();

cli
  .command('run <model> <prompt>', 'Run a one-off prompt')
  .action(async (model: string, prompt: string) => {
    try {
      await runPrompt(model, prompt);
    } catch (error) {
      // v8 ignore next
      const message = error instanceof Error ? error.message : 'Unknown error';
      terminal.writeError(`Error: ${message}\n`);
      process.exitCode = 1;
    }
  });

cli
  .command('resume [sessionId]', 'Resume a saved session')
  .action(async (sessionId?: string) => {
    try {
      if (!sessionId) {
        await launchTui({ initialScreen: SCREEN.SESSION_MANAGER });
        return;
      }

      const loaded = session.loadSession(sessionId);

      if (
        loaded.metadata.directory &&
        loaded.metadata.directory !== process.cwd()
      ) {
        terminal.writeError(
          terminal.color(
            `${UI.WARNING} Cannot resume: session belongs to ${loaded.metadata.directory}\n`,
            'yellow',
          ),
        );
        process.exitCode = 1;
        return;
      }

      await launchTui({ sessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      terminal.writeError(`Error: ${message}\n`);
      process.exitCode = 1;
    }
  });

async function runPrompt(model: string, prompt: string): Promise<void> {
  const messages: ollama.Message[] = [
    agents.createSystemMessage(),
    {
      role: ROLE.USER,
      content: prompt,
    },
  ];

  await processRunStream(messages, model);
  terminal.write('\n');
}

async function processRunStream(
  messages: ollama.Message[],
  model: string,
): Promise<void> {
  let activeMessages = messages;
  let toolTurns = 0;
  let toolIntentCorrections = 0;

  while (toolTurns < MAX_TOOL_TURNS) {
    const assistantMessage: ollama.Message = {
      role: ROLE.ASSISTANT,
      content: '',
    };
    let nextMessages: ollama.Message[] | null = null;

    for await (const chunk of ollama.streamChat(
      activeMessages,
      model,
      tools.TOOLS,
    )) {
      if (chunk.type === 'content') {
        assistantMessage.content = ollama.sanitizeAssistantContent(
          assistantMessage.content + chunk.content,
        );
        terminal.write(chunk.content);
        continue;
      }

      assistantMessage.content = ollama.sanitizeAssistantContent(
        assistantMessage.content,
      );

      // v8 ignore next 3
      if (chunk.tool_calls.length === 0) {
        continue;
      }

      const committedMessages = [...activeMessages, assistantMessage];
      const toolResultMessages: ollama.Message[] = [];

      for (const toolCall of chunk.tool_calls) {
        const result = await tools.executeToolCall(toolCall);
        toolResultMessages.push({
          role: ROLE.SYSTEM,
          content: tools.formatToolResultContent(
            toolCall.function.name,
            result,
            toolCall.function.arguments,
          ),
        });
      }

      nextMessages = [...committedMessages, ...toolResultMessages];
      break;
    }

    if (!nextMessages) {
      assistantMessage.content = ollama.sanitizeAssistantContent(
        assistantMessage.content,
      );

      if (
        ollama.hasUncalledToolIntent(assistantMessage.content) &&
        toolIntentCorrections < MAX_TOOL_INTENT_CORRECTIONS
      ) {
        toolIntentCorrections += 1;
        activeMessages = [
          ...activeMessages,
          assistantMessage,
          { role: ROLE.SYSTEM, content: ollama.TOOL_INTENT_CORRECTION },
        ];
        continue;
      }

      return;
    }

    activeMessages = nextMessages;
    toolTurns += 1;
    toolIntentCorrections = 0;
  }

  // v8 ignore next 3
  terminal.writeError(
    'Tool execution stopped because the maximum tool turn limit was reached\n',
  );
}

export async function main(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  if (args.length) {
    cli.parse(['node', 'code-ollama', ...args]);
  } else {
    await launchTui();
  }
}

async function launchTui(options: LaunchOptions = {}): Promise<void> {
  const { renderApp } = await import('./tui');
  screen.reset();
  renderApp(options);
}

// v8 ignore start
function isEntrypoint(argv1 = process.argv[1]): boolean {
  if (!argv1) {
    return false;
  }

  try {
    return realpathSync(argv1) === import.meta.filename;
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  void main();
}
// v8 ignore stop
