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

  switch (name) {
    case TOOL.READ_FILE:
      return readFile(args.path as string);

    case TOOL.WRITE_FILE:
      return writeFile(args.path as string, args.content as string);

    case TOOL.EDIT_FILE:
      return editFile(
        args.path as string,
        args.oldText as string,
        args.newText as string,
      );

    case TOOL.RUN_SHELL:
      return runShell(args.command as string);

    case TOOL.LIST_DIR:
      return listDir(args.path as string);

    case TOOL.GREP_SEARCH:
      return await grepSearch(args.pattern as string, args.path as string);

    case TOOL.VIEW_RANGE:
      return viewRange(
        args.path as string,
        args.start as number,
        args.end as number,
      );

    case TOOL.WEB_SEARCH:
      return await webSearch(args.query as string);

    case TOOL.WEB_FETCH:
      return await webFetch(args.url as string);

    default:
      return { content: '', error: `Unknown tool: ${name as string}` };
  }
}
