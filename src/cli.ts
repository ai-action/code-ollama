#!/usr/bin/env node

import { realpathSync } from 'node:fs';

import cac from 'cac';

import { PACKAGE, ROLE } from './constants';
import type { ToolName } from './types';
import { agents, ollama, screen, session, tools } from './utils';

const cli = cac('code-ollama');

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
      process.stderr.write(`Error: ${message}\n`);
      process.exitCode = 1;
    }
  });

cli
  .command('resume <sessionId>', 'Resume a saved session')
  .action(async (sessionId: string) => {
    try {
      session.loadSession(sessionId);
      await launchTui(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      process.stderr.write(`Error: ${message}\n`);
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
  process.stdout.write('\n');
}

async function processRunStream(
  messages: ollama.Message[],
  model: string,
): Promise<void> {
  const assistantMessage: ollama.Message = {
    role: ROLE.ASSISTANT,
    content: '',
  };

  for await (const chunk of ollama.streamChat(messages, model, tools.TOOLS)) {
    if (chunk.type === 'content') {
      assistantMessage.content += chunk.content;
      process.stdout.write(chunk.content);
      continue;
    }

    for (const toolCall of chunk.tool_calls) {
      const result = await tools.executeTool(
        toolCall.function.name as ToolName,
        toolCall.function.arguments,
      );

      const toolResultMessage: ollama.Message = {
        role: ROLE.SYSTEM,
        content: `Tool ${toolCall.function.name} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}`,
      };

      await processRunStream(
        [...messages, assistantMessage, toolResultMessage],
        model,
      );
      return;
    }
  }
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

async function launchTui(sessionId?: string): Promise<void> {
  const { renderApp } = await import('./tui');
  screen.reset();
  renderApp(sessionId);
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
