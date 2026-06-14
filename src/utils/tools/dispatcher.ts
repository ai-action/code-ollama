import { TOOL } from '@/constants';
import type { ToolName, ToolResult } from '@/types';
import type { ToolCall } from '@/utils/ollama';

import * as mcp from '../mcp';
import { WRITE_TOOLS } from './definitions';
import {
  createDirectory,
  deletePath,
  editFile,
  findFiles,
  grepSearch,
  listDir,
  readFile,
  renamePath,
  writeFile,
} from './filesystem';
import { runShell } from './shell';
import { webFetch, webSearch } from './web';

interface ToolOptions {
  allowedTools?: ReadonlySet<string>;
}

const ERROR_MAX_CHARS = 2000;
const STACK_MAX_CHARS = 2000;
const OUTPUT_HEAD_CHARS = 8000;
const OUTPUT_TAIL_CHARS = 4000;
const FAILURE_OUTPUT_TAIL_CHARS = 4000;

export interface NormalizedToolCall {
  name: string;
  arguments: Record<string, unknown>;
  requiresApproval: boolean;
}

const REQUIRED_STRING_ARGS: Record<ToolName, string[]> = {
  [TOOL.READ_FILE]: ['path'],
  [TOOL.WRITE_FILE]: ['path', 'content'],
  [TOOL.EDIT_FILE]: ['path', 'oldText', 'newText'],
  [TOOL.CREATE_DIRECTORY]: ['path'],
  [TOOL.RENAME_PATH]: ['from', 'to'],
  [TOOL.DELETE_PATH]: ['path'],
  [TOOL.RUN_SHELL]: ['command'],
  [TOOL.LIST_DIR]: ['path'],
  [TOOL.FIND_FILES]: ['path'],
  [TOOL.GREP_SEARCH]: ['pattern', 'path'],
  [TOOL.WEB_SEARCH]: ['query'],
  [TOOL.WEB_FETCH]: ['url'],
} as const;

const TOOL_NAMES = new Set<string>(
  Object.values(TOOL).filter((value) => typeof value === 'string'),
);

function isToolName(name: string): name is ToolName {
  return TOOL_NAMES.has(name);
}

function validateArgs(
  name: ToolName,
  args: Record<string, unknown>,
): ToolResult | undefined {
  const required = REQUIRED_STRING_ARGS[name];
  const received = Object.keys(args).join(', ') || 'none';

  for (const key of required) {
    if (typeof args[key] !== 'string' || !args[key]) {
      return {
        content: '',
        error: `Missing required argument: ${key} (received keys: ${received})`,
      };
    }
  }

  if (name === TOOL.READ_FILE) {
    const numericArgs = [
      'startLine',
      'endLine',
      'maxLines',
      'maxChars',
    ] as const;

    for (const key of numericArgs) {
      if (args[key] !== undefined && !Number.isInteger(args[key])) {
        return {
          content: '',
          error: `Invalid optional numeric argument: ${key} (received keys: ${received})`,
        };
      }
    }

    if (
      (typeof args.startLine === 'number' && args.startLine < 1) ||
      (typeof args.endLine === 'number' && args.endLine < 1) ||
      (typeof args.maxLines === 'number' && args.maxLines < 1)
    ) {
      return {
        content: '',
        error:
          'Invalid read range: startLine, endLine, and maxLines must be >= 1',
      };
    }

    if (typeof args.maxChars === 'number' && args.maxChars < 1) {
      return {
        content: '',
        error: 'Invalid read range: maxChars must be >= 1',
      };
    }

    if (args.endLine !== undefined && args.maxLines !== undefined) {
      return {
        content: '',
        error: 'Invalid read range: endLine cannot be combined with maxLines',
      };
    }

    if (
      typeof args.startLine === 'number' &&
      typeof args.endLine === 'number' &&
      args.endLine < args.startLine
    ) {
      return {
        content: '',
        error: 'Invalid read range: endLine must be >= startLine',
      };
    }
  }

  if (name === TOOL.DELETE_PATH && typeof args.recursive !== 'boolean') {
    return {
      content: '',
      error: `Missing required boolean argument: recursive (received keys: ${received})`,
    };
  }

  if (
    name === TOOL.FIND_FILES &&
    args.pattern !== undefined &&
    typeof args.pattern !== 'string'
  ) {
    return {
      content: '',
      error: `Invalid optional argument: pattern must be a string (received keys: ${received})`,
    };
  }

  if (
    name === TOOL.FIND_FILES &&
    args.includeHidden !== undefined &&
    typeof args.includeHidden !== 'boolean'
  ) {
    return {
      content: '',
      error: `Invalid optional argument: includeHidden must be a boolean (received keys: ${received})`,
    };
  }

  if (name === TOOL.WEB_FETCH) {
    try {
      const url = new URL(args.url as string);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { content: '', error: 'URL must use http or https' };
      }
    } catch {
      return { content: '', error: 'Invalid URL' };
    }
  }
}

export function normalizeToolCall(toolCall: ToolCall): NormalizedToolCall {
  const name = toolCall.function.name;
  const rawArguments: unknown = toolCall.function.arguments;

  if (!isToolName(name)) {
    if (!mcp.isMcpToolName(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }
  }

  if (
    typeof rawArguments !== 'object' ||
    rawArguments === null ||
    Array.isArray(rawArguments)
  ) {
    throw new Error(`Invalid arguments for tool: ${name}`);
  }

  const normalizedArguments = rawArguments as Record<string, unknown>;
  const invalid = isToolName(name)
    ? validateArgs(name, normalizedArguments)
    : undefined;
  if (invalid?.error) {
    throw new Error(invalid.error);
  }

  return {
    name,
    arguments: normalizedArguments,
    requiresApproval: mcp.isMcpToolName(name) || WRITE_TOOLS.has(name),
  };
}

export function formatToolResultContent(
  toolName: string,
  result: ToolResult,
  args?: Record<string, unknown>,
): string {
  const formattedArgs = args ? `(${formatToolArguments(args)})` : '';
  const status = result.error
    ? 'The requested action did not complete successfully'
    : '';
  const hasFailureOutputTail =
    !!result.error && result.content.length > FAILURE_OUTPUT_TAIL_CHARS;
  const content = result.content
    ? `\nOutput:\n${formatOutput(result.content, {
        omitTail: hasFailureOutputTail,
      })}`
    : '';
  const error = result.error
    ? `\nError: ${truncateEnd(result.error, ERROR_MAX_CHARS, 'error')}`
    : '';
  const stack =
    result.error && result.stack
      ? `\nStack trace:\n${truncateEnd(result.stack, STACK_MAX_CHARS, 'stack trace')}`
      : '';
  const failureOutputTail = hasFailureOutputTail
    ? `\nFailure output tail:\n${result.content.slice(-FAILURE_OUTPUT_TAIL_CHARS)}`
    : '';

  return [
    `Tool ${toolName}${formattedArgs} result:`,
    status,
    error.trim(),
    stack.trim(),
    failureOutputTail.trim(),
    content.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}

function truncateEnd(value: string, maxChars: number, label: string): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n[${label} truncated: showing first ${String(maxChars)} of ${String(value.length)} chars]`;
}

function formatOutput(
  content: string,
  options: { omitTail?: boolean } = {},
): string {
  if (options.omitTail && content.length > OUTPUT_TAIL_CHARS) {
    const headChars = Math.min(
      OUTPUT_HEAD_CHARS,
      content.length - OUTPUT_TAIL_CHARS,
    );
    return [
      content.slice(0, headChars),
      `[tool output truncated: showing first ${String(headChars)} of ${String(content.length)} chars; failure tail shown above]`,
    ].join('\n');
  }

  const maxChars = OUTPUT_HEAD_CHARS + OUTPUT_TAIL_CHARS;
  if (content.length <= maxChars) {
    return content;
  }

  return [
    content.slice(0, OUTPUT_HEAD_CHARS),
    `[tool output truncated: showing first ${String(OUTPUT_HEAD_CHARS)} and last ${String(OUTPUT_TAIL_CHARS)} of ${String(content.length)} chars]`,
    content.slice(-OUTPUT_TAIL_CHARS),
  ].join('\n');
}

function formatToolArguments(args: Record<string, unknown>): string {
  return JSON.stringify(args, (_, value: unknown) => {
    if (typeof value !== 'string') {
      return value;
    }

    if (value.length <= 80 && !value.includes('\n')) {
      return value;
    }

    return `<${String(value.length)} chars>`;
  });
}

export async function executeToolCall(
  toolCall: ToolCall,
  options?: ToolOptions,
): Promise<ToolResult> {
  try {
    const normalized = normalizeToolCall(toolCall);
    return await executeTool(normalized.name, normalized.arguments, options);
  } catch (error) {
    return {
      content: '',
      // v8 ignore next
      error: error instanceof Error ? error.message : String(error),
      // v8 ignore next
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    };
  }
}

/**
 * Execute a tool by name with arguments
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  options?: ToolOptions,
): Promise<ToolResult> {
  if (mcp.isMcpToolName(name)) {
    if (options?.allowedTools && !options.allowedTools.has(name)) {
      return {
        content: '',
        error: `Tool not allowed: ${name}`,
      };
    }

    return mcp.callMcpTool(name, args);
  }

  if (!isToolName(name)) {
    return { content: '', error: `Unknown tool: ${name}` };
  }

  if (options?.allowedTools && !options.allowedTools.has(name)) {
    return {
      content: '',
      error: `Tool not allowed: ${name}`,
    };
  }

  const invalid = validateArgs(name, args);
  if (invalid) {
    return invalid;
  }

  const stringArgs = args as Record<string, string>;

  switch (name) {
    case TOOL.READ_FILE:
      return readFile(stringArgs.path, {
        endLine: args.endLine as number | undefined,
        maxChars: args.maxChars as number | undefined,
        maxLines: args.maxLines as number | undefined,
        startLine: args.startLine as number | undefined,
      });

    case TOOL.WRITE_FILE:
      return writeFile(stringArgs.path, stringArgs.content);

    case TOOL.EDIT_FILE:
      return editFile(stringArgs.path, stringArgs.oldText, stringArgs.newText);

    case TOOL.CREATE_DIRECTORY:
      return createDirectory(stringArgs.path);

    case TOOL.RENAME_PATH:
      return renamePath(stringArgs.from, stringArgs.to);

    case TOOL.DELETE_PATH:
      return deletePath(stringArgs.path, args.recursive as boolean);

    case TOOL.RUN_SHELL:
      return runShell(stringArgs.command);

    case TOOL.LIST_DIR:
      return listDir(stringArgs.path);

    case TOOL.FIND_FILES:
      return await findFiles(stringArgs.path, {
        includeHidden: args.includeHidden as boolean | undefined,
        pattern: stringArgs.pattern,
      });

    case TOOL.GREP_SEARCH:
      return await grepSearch(stringArgs.pattern, stringArgs.path);

    case TOOL.WEB_SEARCH:
      return await webSearch(stringArgs.query);

    case TOOL.WEB_FETCH:
      return await webFetch(stringArgs.url);

    // v8 ignore next 2
    default:
      return { content: '', error: `Unknown tool: ${String(name)}` };
  }
}
