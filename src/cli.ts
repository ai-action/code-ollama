#!/usr/bin/env node

import cac from 'cac';

import { PACKAGE, ROLE } from './constants';
import { agents, ollama, screen, tools } from './utils';

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
        toolCall.function.name,
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
  if (!args.length) {
    const { renderApp } = await import('./tui');

    screen.clear();
    renderApp();
    return;
  }

  cli.parse(['node', 'code-ollama', ...args]);
}

// v8 ignore next 3
if (process.argv[1] === import.meta.filename) {
  void main();
}
