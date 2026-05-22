import { TOOL } from '@/constants';
import type { ToolName, ToolResult } from '@/types';

import {
  editFile,
  grepSearch,
  listDir,
  readFile,
  viewRange,
  writeFile,
} from './filesystem';
import { runShell } from './shell';
import { webFetch, webSearch } from './web';

interface ToolOptions {
  allowedTools?: ReadonlySet<string>;
}

const REQUIRED_STRING_ARGS: Partial<Record<ToolName, string[]>> = {
  [TOOL.READ_FILE]: ['path'],
  [TOOL.WRITE_FILE]: ['path', 'content'],
  [TOOL.EDIT_FILE]: ['path', 'oldText', 'newText'],
  [TOOL.RUN_SHELL]: ['command'],
  [TOOL.LIST_DIR]: ['path'],
  [TOOL.GREP_SEARCH]: ['pattern', 'path'],
  [TOOL.VIEW_RANGE]: ['path'],
  [TOOL.WEB_SEARCH]: ['query'],
  [TOOL.WEB_FETCH]: ['url'],
} as const;

function validateArgs(
  name: ToolName,
  args: Record<string, unknown>,
): ToolResult | undefined {
  const required = REQUIRED_STRING_ARGS[name] ?? [];
  const received = Object.keys(args).join(', ') || 'none';

  for (const key of required) {
    if (typeof args[key] !== 'string') {
      return {
        content: '',
        error: `Missing required argument: ${key} (received keys: ${received})`,
      };
    }
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
      return readFile(stringArgs.path);

    case TOOL.WRITE_FILE:
      return writeFile(stringArgs.path, stringArgs.content);

    case TOOL.EDIT_FILE:
      return editFile(stringArgs.path, stringArgs.oldText, stringArgs.newText);

    case TOOL.RUN_SHELL:
      return runShell(stringArgs.command);

    case TOOL.LIST_DIR:
      return listDir(stringArgs.path);

    case TOOL.GREP_SEARCH:
      return await grepSearch(stringArgs.pattern, stringArgs.path);

    case TOOL.VIEW_RANGE:
      return viewRange(
        stringArgs.path,
        args.start as number,
        args.end as number,
      );

    case TOOL.WEB_SEARCH:
      return await webSearch(stringArgs.query);

    case TOOL.WEB_FETCH:
      return await webFetch(stringArgs.url);

    default:
      return { content: '', error: `Unknown tool: ${name as string}` };
  }
}
