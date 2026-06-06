import { Ollama, type Tool } from 'ollama';

import type { Role, ToolDiff } from '@/types';

import { loadConfig } from './config';

const { host } = loadConfig();

const client = new Ollama({ host });

export interface Message {
  role: Role;
  content: string;
  images?: string[];
  tool_calls?: ToolCall[];
  toolResult?: {
    name: string;
    diff?: ToolDiff;
  };
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export type StreamChunk =
  | { type: 'content'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[] };

const TRAILING_CONTROL_TOKEN_REGEX = /(?:\s*<\|?channel\|?>)+\s*$/;
const TOOL_INTENT_REGEX =
  /\b(?:(?:next|now|first),?\s+)?i\s+(?:will|am going to)\s+(?:use\s+(?:a\s+)?tool\s+to\s+|call\s+(?:a\s+)?tool\s+to\s+)?(?:read|inspect|check|list|search|update|edit|write|modify|run)\b/i;

export const TOOL_INTENT_CORRECTION =
  'You said you would use a tool but did not call one. Continue by calling the appropriate tool now. Do not describe the tool call.';

export function sanitizeAssistantContent(content: string): string {
  return content.replace(TRAILING_CONTROL_TOKEN_REGEX, '');
}

export function hasUncalledToolIntent(content: string): boolean {
  return TOOL_INTENT_REGEX.test(content);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(host);
    return response.ok;
  } catch {
    return false;
  }
}

export async function* streamChat(
  messages: Message[],
  model: string,
  tools?: Tool[],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, unknown> {
  const providerMessages = messages.map(
    ({ role, content, images, tool_calls }) => ({
      role,
      content,
      ...(images ? { images } : {}),
      ...(tool_calls ? { tool_calls } : {}),
    }),
  );

  const response = await client.chat({
    model,
    messages: providerMessages,
    stream: true,
    tools,
    // v8 ignore next
    ...(signal ? { signal } : {}),
  });

  try {
    for await (const chunk of response) {
      // v8 ignore next 3
      if (signal?.aborted) {
        return;
      }

      if (chunk.message.content) {
        yield { type: 'content', content: chunk.message.content };
      }

      if (chunk.message.tool_calls) {
        yield { type: 'tool_calls', tool_calls: chunk.message.tool_calls };
      }
    }
  } catch (error) {
    // v8 ignore start
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || signal?.aborted)
    ) {
      return;
    }

    throw error;
    // v8 ignore stop
  }
}

export async function listModels(): Promise<string[]> {
  const { models } = await client.list();
  return models.map(({ name }) => name);
}

export async function pullModel(model: string) {
  return client.pull({ model, stream: true });
}

export function deleteModel(model: string) {
  return client.delete({ model });
}
