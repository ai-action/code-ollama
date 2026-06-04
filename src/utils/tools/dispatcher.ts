import { TOOL } from '@/constants';
import type { ToolName, ToolResult } from '@/types';
import type { ToolCall } from '@/utils/ollama';

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

export interface NormalizedToolCall {
  name: ToolName;
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
    const numericArgs = ['startLine', 'endLine', 'maxLines'] as const;

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

  if (name === TOOL.FIND_FILES && args.ignoredDirs !== undefined) {
    if (
      !Array.isArray(args.ignoredDirs) ||
      !args.ignoredDirs.every((value) => typeof value === 'string')
    ) {
      return {
        content: '',
        error: `Invalid optional argument: ignoredDirs must be an array of strings (received keys: ${received})`,
      };
    }
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
    throw new Error(`Unknown tool: ${name}`);
  }

  if (
    typeof rawArguments !== 'object' ||
    rawArguments === null ||
    Array.isArray(rawArguments)
  ) {
    throw new Error(`Invalid arguments for tool: ${name}`);
  }

  const normalizedArguments = rawArguments as Record<string, unknown>;
  const invalid = validateArgs(name, normalizedArguments);
  if (invalid?.error) {
    throw new Error(invalid.error);
  }

  return {
    name,
    arguments: normalizedArguments,
    requiresApproval: WRITE_TOOLS.has(name),
  };
}

export function formatToolResultContent(
  toolName: string,
  result: ToolResult,
  args?: Record<string, unknown>,
): string {
  const formattedArgs = args ? `(${formatToolArguments(args)})` : '';
  const status = result.error ? 'The requested action was NOT performed' : '';
  const content = result.content ? `\n${result.content}` : '';
  const error = result.error ? `\nError: ${result.error}` : '';
  const stack =
    result.error && result.stack ? `\nStack trace:\n${result.stack}` : '';

  return [
    `Tool ${toolName}${formattedArgs} result:`,
    status,
    content.trim(),
    error.trim(),
    stack.trim(),
  ]
    .filter(Boolean)
    .join('\n');
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
  name: ToolName,
  args: Record<string, unknown>,
  options?: ToolOptions,
): Promise<ToolResult> {
  if (!isToolName(name)) {
    return { content: '', error: `Unknown tool: ${name as string}` };
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
      return findFiles(stringArgs.path, {
        ignoredDirs: args.ignoredDirs as string[] | undefined,
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
      return { content: '', error: `Unknown tool: ${name as string}` };
  }
}
