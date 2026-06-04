import { TOOL } from '@/constants';
import type { ToolName } from '@/types';

/**
 * Helper to define tool parameters
 */
function defineTool(
  name: ToolName,
  description: string,
  params: Record<
    string,
    {
      type: string;
      description: string;
      items?: { type: string; description: string };
    }
  >,
  required: string[],
) {
  return {
    type: 'function' as const,
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: params,
        required,
      },
    },
  };
}

/**
 * Tool definitions for Ollama API
 */
export const TOOLS = [
  defineTool(
    TOOL.READ_FILE,
    'Read the contents of a file at the specified path',
    {
      path: { type: 'string', description: 'The path to the file to read' },
    },
    ['path'],
  ),

  defineTool(
    TOOL.WRITE_FILE,
    'Write content to a file at the specified path',
    {
      path: { type: 'string', description: 'The path to the file to write' },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    ['path', 'content'],
  ),

  defineTool(
    TOOL.EDIT_FILE,
    'Replace one exact text match in an existing file at the specified path',
    {
      path: { type: 'string', description: 'The path to the file to edit' },
      oldText: {
        type: 'string',
        description: 'The exact existing text to replace',
      },
      newText: {
        type: 'string',
        description: 'The replacement text to write in place of oldText',
      },
    },
    ['path', 'oldText', 'newText'],
  ),

  defineTool(
    TOOL.CREATE_DIRECTORY,
    'Create a directory and any missing parent directories at the specified path',
    {
      path: {
        type: 'string',
        description: 'The directory path to create',
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.RENAME_PATH,
    'Rename or move an existing file or directory to a new path',
    {
      from: {
        type: 'string',
        description: 'The existing file or directory path to rename or move',
      },
      to: {
        type: 'string',
        description: 'The destination path for the renamed or moved item',
      },
    },
    ['from', 'to'],
  ),

  defineTool(
    TOOL.DELETE_PATH,
    'Delete a file or directory at the specified path',
    {
      path: {
        type: 'string',
        description: 'The file or directory path to delete',
      },
      recursive: {
        type: 'boolean',
        description:
          'Whether to delete non-empty directories recursively; use false for files and empty directories',
      },
    },
    ['path', 'recursive'],
  ),

  defineTool(
    TOOL.RUN_SHELL,
    'Execute a shell command',
    {
      command: { type: 'string', description: 'The shell command to execute' },
    },
    ['command'],
  ),

  defineTool(
    TOOL.LIST_DIR,
    'List the contents of a directory',
    {
      path: {
        type: 'string',
        description: 'The path to the directory to list',
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.FIND_FILES,
    'Recursively find files under a directory, optionally matching a simple substring or wildcard pattern',
    {
      path: {
        type: 'string',
        description: 'The directory path to search in',
      },
      pattern: {
        type: 'string',
        description:
          'Optional case-insensitive substring or wildcard pattern to match against file paths',
      },
      includeHidden: {
        type: 'boolean',
        description:
          'Whether to include hidden files and directories; defaults to false',
      },
      ignoredDirs: {
        type: 'array',
        description:
          'Optional directory names to skip instead of the default ignored directory list; .git is always skipped',
        items: { type: 'string', description: 'Directory name to skip' },
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.GREP_SEARCH,
    'Search files within a directory; multi-word queries also match common code identifier forms',
    {
      pattern: {
        type: 'string',
        description: 'The regex, phrase, or code concept to search for',
      },
      path: { type: 'string', description: 'The directory path to search in' },
    },
    ['pattern', 'path'],
  ),

  defineTool(
    TOOL.VIEW_RANGE,
    'View a specific range of lines from a file',
    {
      path: { type: 'string', description: 'The path to the file' },
      start: {
        type: 'number',
        description: 'The starting line number (1-indexed)',
      },
      end: {
        type: 'number',
        description: 'The ending line number (inclusive)',
      },
    },
    ['path', 'start', 'end'],
  ),

  defineTool(
    TOOL.WEB_SEARCH,
    'Search the web for external or current information',
    {
      query: { type: 'string', description: 'The search query to look up' },
    },
    ['query'],
  ),

  defineTool(
    TOOL.WEB_FETCH,
    'Fetch the readable content of a webpage at the given URL',
    {
      url: { type: 'string', description: 'The full URL of the page to fetch' },
    },
    ['url'],
  ),
];

// tools that can be used during plan mode
export const READ_TOOLS = new Set<string>(TOOL.READ_TOOL_NAMES);

// tools that require approval before execution (safe mode or plan approval)
export const WRITE_TOOLS = new Set<string>(TOOL.WRITE_TOOL_NAMES);
