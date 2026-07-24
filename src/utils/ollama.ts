import { Ollama, type Tool } from 'ollama';

export type { ToolCallProgress } from './tools/dispatcher';

import type { Role, ToolDiff } from '@/types';

import { loadConfig } from './config';

let { host } = loadConfig();

let client = new Ollama({ host });

export interface Message {
  role: Role;
  content: string;
  images?: string[];
  tool_calls?: ToolCall[];
  toolResult?: {
    name: string;
    diff?: ToolDiff;
    error?: string;
  };
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaCallStats {
  model: string;
  promptTokens: number;
  outputTokens: number;
  totalDurationNs: number;
  loadDurationNs: number;
  promptEvalDurationNs: number;
  evalDurationNs: number;
}

export type StreamChunk =
  | { type: 'content'; content: string }
  | { type: 'stats'; stats: OllamaCallStats }
  | { type: 'tool_calls'; tool_calls: ToolCall[] };

const TRAILING_CONTROL_TOKEN_REGEX = /(?:\s*<\|?channel\|?>)+\s*$/;
const TOOL_INTENT_PREFIX = String.raw`\b(?:(?:next|now|first),?\s+)?i(?:\s+(?:will|am going to)|['’]ll)\s+(?:now\s+)?(?:use\s+(?:a\s+)?tool\s+to\s+|call\s+(?:a\s+)?tool\s+to\s+)?`;
const TOOL_ACTION_GERUNDS =
  'reading|inspecting|checking|listing|searching|updating|editing|writing|modifying|running|creating|deleting|removing|renaming|moving';
const READ_TOOL_INTENT_REGEX = new RegExp(
  `${TOOL_INTENT_PREFIX}(?:read|inspect|check|list|search|update|edit|write|modify|run)\\b`,
  'i',
);
const STATE_CHANGE_INTENT_REGEX = new RegExp(
  `${TOOL_INTENT_PREFIX}(?:stage|commit|delete|remove|create|rename|move|apply)\\b[^.!?\\n]*(?:file|path|dir|directory|folder|change|changes|deletion|commit|branch|repo|repository|staged|\\.[\\w-]+|[\\w./-]+/[\\w./-]+)`,
  'i',
);
const PROCEED_WITH_TOOL_ACTION_REGEX =
  /\bi\s+(?:will|am going to)\s+(?:now\s+)?proceed\s+with\s+(?:reading|inspecting|checking|listing|searching|updating|editing|writing|modifying|running|creating|deleting|removing|renaming|moving)\b/i;
const DEFERRED_TOOL_ACTION_REGEX = new RegExp(
  `${TOOL_INTENT_PREFIX}(?:(?:start|begin)\\s+by\\s+|try\\s+)(?:${TOOL_ACTION_GERUNDS})\\b`,
  'i',
);
const INDIRECT_TOOL_ACTION_REGEX = new RegExp(
  `${TOOL_INTENT_PREFIX}(?:perform|make|carry\\s+out|execute)\\s+(?:(?:the|this|an?)\\s+)?(?:edit|change|update|modification|replacement)\\b`,
  'i',
);
const NAMED_TOOL_INTENT_REGEX =
  /\bi\s+(?:will|am going to)\s+(?:now\s+)?(?:use|call|invoke|run)\s+(?:the\s+)?`?[a-z][\w-]*`?\s+tool\b/i;
const FUTURE_NAMED_TOOL_OUTPUT_REGEX =
  /\bi\s+(?:will|am going to)\s+(?:now\s+)?(?:generate|prepare|create|submit)\b[^.!?\n]*\b(?:using|with|via)\s+(?:the\s+)?`?(?:[a-z][\w-]*_[\w-]+|[a-z][\w-]*\s+tool)`?(?=\s|[.!?,]|$)/i;
const SERIALIZED_TOOL_CALL_REGEX =
  /(?:<\|?tool_call\|?>|<tool_call\|>|\btool_name\s*:\s*[a-z][\w-]*|(?:^|\n)\s*tool\s+[a-z][\w-]*\s*\()/i;

export const TOOL_INTENT_CORRECTION =
  'You described or printed a tool action without calling it. Call the appropriate tool through the provided tool interface now. Do not describe or print the tool call.';

export function sanitizeAssistantContent(content: string): string {
  return content.replace(TRAILING_CONTROL_TOKEN_REGEX, '');
}

export function hasSerializedToolCall(content: string): boolean {
  return SERIALIZED_TOOL_CALL_REGEX.test(content);
}

export function hasUncalledToolIntent(content: string): boolean {
  const normalizedContent = content.replace(/[*_~`]/g, '');

  return (
    READ_TOOL_INTENT_REGEX.test(normalizedContent) ||
    STATE_CHANGE_INTENT_REGEX.test(normalizedContent) ||
    PROCEED_WITH_TOOL_ACTION_REGEX.test(normalizedContent) ||
    DEFERRED_TOOL_ACTION_REGEX.test(normalizedContent) ||
    INDIRECT_TOOL_ACTION_REGEX.test(normalizedContent) ||
    NAMED_TOOL_INTENT_REGEX.test(normalizedContent) ||
    FUTURE_NAMED_TOOL_OUTPUT_REGEX.test(content) ||
    hasSerializedToolCall(content)
  );
}

export async function checkHealth(
  candidateHost = host,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch(
      candidateHost,
      // Preserve the ordinary one-argument fetch call when no signal is needed.
      ...(signal ? [{ signal }] : []),
    );
    return response.ok;
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return false;
  }
}

export function configureHost(nextHost: string): void {
  if (nextHost === host) {
    return;
  }

  host = nextHost;
  client = new Ollama({ host });
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
    think: false,
    // v8 ignore next
    ...(signal ? { signal } : {}),
  });
  const toolCalls: ToolCall[] = [];
  let stats: OllamaCallStats | undefined;

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
        toolCalls.push(...chunk.message.tool_calls);
      }

      if (chunk.done) {
        stats = {
          model,
          promptTokens: chunk.prompt_eval_count,
          outputTokens: chunk.eval_count,
          totalDurationNs: chunk.total_duration,
          loadDurationNs: chunk.load_duration,
          promptEvalDurationNs: chunk.prompt_eval_duration,
          evalDurationNs: chunk.eval_duration,
        };
      }
    }

    if (stats) {
      yield { type: 'stats', stats };
    }

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', tool_calls: toolCalls };
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
