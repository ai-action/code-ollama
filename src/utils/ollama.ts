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
  | { type: 'thinking' }
  | { type: 'stats'; stats: OllamaCallStats }
  | { type: 'tool_calls'; tool_calls: ToolCall[] };

export type ToolCommitmentAction = 'mutate' | 'read' | 'tool' | 'verify';
export type AssistantContentClassification =
  | { type: 'complete' }
  | { type: 'empty' }
  | { type: 'serialized-tool-call' }
  | {
      type: 'tool-commitment';
      action: ToolCommitmentAction;
      verb: string;
    };

const TRAILING_CONTROL_TOKEN_REGEX = /(?:\s*<\|?channel\|?>)+\s*$/;
const FUTURE_ACTION_CLAUSE_REGEX =
  /\b(?:(?:next|now|first),?\s+)?i(?:\s+(?:will|am going to)|['’]ll)\s+([^.!?\n]+)/i;
const ACTION_PREAMBLE_REGEX =
  /^(?:now\s+)?(?:(?:use|call)\s+(?:a\s+)?tool\s+to\s+)?(?:(?:start|begin)\s+by\s+|try\s+|proceed\s+with\s+)?/i;
const INDIRECT_TOOL_ACTION_REGEX = new RegExp(
  '^(?:perform|make|carry\\s+out|execute)\\s+(?:(?:the|this|an?)\\s+)?(edit|change|update|modification|replacement)\\b',
  'i',
);
const NAMED_TOOL_ACTION_REGEX =
  /^(?:use|call|invoke|run)\s+(?:the\s+)?([a-z][\w-]*)\s+tool\b(?!\s+to)/i;
const FUTURE_NAMED_TOOL_OUTPUT_REGEX =
  /\bi\s+(?:will|am going to)\s+(?:now\s+)?(?:generate|prepare|create|submit)\b[^.!?\n]*\b(?:using|with|via)\s+(?:the\s+)?`?(?:[a-z][\w-]*_[\w-]+|[a-z][\w-]*\s+tool)`?(?=\s|[.!?,]|$)/i;
const SERIALIZED_TOOL_CALL_REGEX =
  /(?:<\|?tool_call\|?>|<tool_call\|>|\btool_name\s*:\s*[a-z][\w-]*|(?:^|\n)\s*tool\s+[a-z][\w-]*\s*\()/i;
const TOOL_TARGET_REGEX =
  /\b(?:file|path|dir|directory|folder|change|changes|deletion|commit|branch|repo|repository|staged)\b|\.[\w-]+\b|[\w./-]+\/[\w./-]+/i;

const READ_ACTIONS = new Set([
  'check',
  'checking',
  'inspect',
  'inspecting',
  'list',
  'listing',
  'read',
  'reading',
  'search',
  'searching',
]);
const MUTATION_ACTIONS = new Set([
  'edit',
  'editing',
  'modify',
  'modifying',
  'replace',
  'replacing',
  'update',
  'updating',
  'write',
  'writing',
]);
const TARGETED_MUTATION_ACTIONS = new Set([
  'apply',
  'applying',
  'commit',
  'committing',
  'create',
  'creating',
  'delete',
  'deleting',
  'move',
  'moving',
  'remove',
  'removing',
  'rename',
  'renaming',
  'stage',
  'staging',
]);
const VERIFICATION_ACTIONS = new Set([
  'build',
  'building',
  'lint',
  'linting',
  'run',
  'running',
  'test',
  'testing',
  'verify',
  'verifying',
]);

export const TOOL_INTENT_CORRECTION =
  'You described or printed a tool action without calling it. Call the appropriate tool through the provided tool interface now. Do not describe or print the tool call.';

export function sanitizeAssistantContent(content: string): string {
  return content.replace(TRAILING_CONTROL_TOKEN_REGEX, '');
}

export function hasSerializedToolCall(content: string): boolean {
  return SERIALIZED_TOOL_CALL_REGEX.test(content);
}

export function classifyAssistantContent(
  content: string,
): AssistantContentClassification {
  if (!content.trim()) {
    return { type: 'empty' };
  }
  if (hasSerializedToolCall(content)) {
    return { type: 'serialized-tool-call' };
  }
  if (FUTURE_NAMED_TOOL_OUTPUT_REGEX.test(content)) {
    return { type: 'tool-commitment', action: 'tool', verb: 'tool' };
  }

  const normalizedContent = content.replace(/[*_~`]/g, '');
  const futureClause = FUTURE_ACTION_CLAUSE_REGEX.exec(normalizedContent)?.[1];
  if (!futureClause) {
    return { type: 'complete' };
  }

  const clause = futureClause.trim();
  const namedTool = NAMED_TOOL_ACTION_REGEX.exec(clause);
  if (namedTool) {
    return {
      type: 'tool-commitment',
      action: 'tool',
      verb: namedTool[1].toLowerCase(),
    };
  }

  const actionClause = clause.replace(ACTION_PREAMBLE_REGEX, '');
  const indirectAction = INDIRECT_TOOL_ACTION_REGEX.exec(actionClause);
  if (indirectAction) {
    return {
      type: 'tool-commitment',
      action: 'mutate',
      verb: indirectAction[1].toLowerCase(),
    };
  }

  const verb = /^[a-z]+/i.exec(actionClause)?.[0].toLowerCase();
  if (!verb) {
    return { type: 'complete' };
  }
  if (READ_ACTIONS.has(verb)) {
    return { type: 'tool-commitment', action: 'read', verb };
  }
  if (MUTATION_ACTIONS.has(verb)) {
    return { type: 'tool-commitment', action: 'mutate', verb };
  }
  if (
    TARGETED_MUTATION_ACTIONS.has(verb) &&
    TOOL_TARGET_REGEX.test(actionClause)
  ) {
    return { type: 'tool-commitment', action: 'mutate', verb };
  }
  if (VERIFICATION_ACTIONS.has(verb)) {
    return { type: 'tool-commitment', action: 'verify', verb };
  }

  return { type: 'complete' };
}

export function hasUncalledToolIntent(content: string): boolean {
  const classification = classifyAssistantContent(content);
  return (
    classification.type === 'serialized-tool-call' ||
    classification.type === 'tool-commitment'
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
    // v8 ignore next
    ...(signal ? { signal } : {}),
  });
  const toolCalls: ToolCall[] = [];
  let stats: OllamaCallStats | undefined;
  let reportedThinking = false;

  try {
    for await (const chunk of response) {
      // v8 ignore next 3
      if (signal?.aborted) {
        return;
      }

      if (chunk.message.content) {
        yield { type: 'content', content: chunk.message.content };
      }

      if (chunk.message.thinking && !reportedThinking) {
        reportedThinking = true;
        yield { type: 'thinking' };
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
