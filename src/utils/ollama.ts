import { Ollama } from 'ollama';

import type { Role } from '../constants';
import { loadConfig } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tool = any;

const { host, model: DEFAULT_MODEL } = loadConfig();

const client = new Ollama({ host });

export interface Message {
  role: Role;
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolResult {
  name: string;
  content: string;
  error?: string;
}

export type StreamChunk =
  | { type: 'content'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[] };

export async function* streamChat(
  messages: Message[],
  model: string = DEFAULT_MODEL,
  tools?: Tool[],
): AsyncGenerator<StreamChunk, void, unknown> {
  const response = await client.chat({
    model,
    messages,
    stream: true,
    tools,
  });

  for await (const chunk of response) {
    if (chunk.message.content) {
      yield { type: 'content', content: chunk.message.content };
    }
    if (chunk.message.tool_calls) {
      yield { type: 'tool_calls', tool_calls: chunk.message.tool_calls };
    }
  }
}

export async function listModels(): Promise<string[]> {
  const { models } = await client.list();
  return models.map(({ name }) => name);
}
