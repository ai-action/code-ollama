import { exec } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { TOOL } from '../constants';
import type { ToolName } from '../types';

const execAsync = promisify(exec);

/**
 * Helper to define tool parameters
 */
function defineTool(
  name: ToolName,
  description: string,
  params: Record<string, { type: string; description: string }>,
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
    TOOL.GREP_SEARCH,
    'Search for a pattern in files within a directory',
    {
      pattern: {
        type: 'string',
        description: 'The regex pattern to search for',
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
];

// tools that can be used during plan mode
export const READ_TOOLS = new Set<string>([
  TOOL.READ_FILE,
  TOOL.LIST_DIR,
  TOOL.GREP_SEARCH,
  TOOL.VIEW_RANGE,
]);

// tools that require approval before execution (safe mode or plan approval)
export const WRITE_TOOLS = new Set<string>([
  TOOL.WRITE_FILE,
  TOOL.EDIT_FILE,
  TOOL.RUN_SHELL,
]);

export interface ToolResult {
  content: string;
  error?: string;
}

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

    default:
      return { content: '', error: `Unknown tool: ${name as string}` };
  }
}

/**
 * Read file contents
 */
function readFile(filePath: string): ToolResult {
  try {
    if (!existsSync(filePath)) {
      return { content: '', error: `File not found: ${filePath}` };
    }

    const content = readFileSync(filePath, 'utf8');
    return { content };
  } catch (error) {
    return {
      content: '',
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Write content to file
 */
function writeFile(filePath: string, content: string): ToolResult {
  try {
    writeFileSync(filePath, content, 'utf8');
    return { content: `File written successfully: ${filePath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Replace one exact text match in an existing file
 */
function editFile(
  filePath: string,
  oldText: string,
  newText: string,
): ToolResult {
  try {
    if (!existsSync(filePath)) {
      return { content: '', error: `File not found: ${filePath}` };
    }

    const content = readFileSync(filePath, 'utf8');

    if (!content.includes(oldText)) {
      return {
        content: '',
        error: `Exact text not found in file: ${filePath}`,
      };
    }

    const matchCount = content.split(oldText).length - 1;
    if (matchCount > 1) {
      return {
        content: '',
        error: `Exact text matched multiple locations in file: ${filePath}`,
      };
    }

    const updatedContent = content.replace(oldText, newText);
    writeFileSync(filePath, updatedContent, 'utf8');

    return { content: `File edited successfully: ${filePath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Shared shell execution options
const SHELL_EXEC_OPTIONS = {
  timeout: 30000,
  maxBuffer: 1024 * 1024, // 1MB buffer
};

/**
 * Execute shell command with shared options (throws on error)
 */
function execShell(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(command, SHELL_EXEC_OPTIONS);
}

/**
 * Execute shell command
 */
async function runShell(command: string): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execShell(command);
    return { content: stdout || stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: '',
      error: `Command failed: ${message}`,
    };
  }
}

/**
 * List directory contents
 */
function listDir(dirPath: string): ToolResult {
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const lines = entries.map((entry) => {
      const type = entry.isDirectory() ? 'd' : 'f';
      return `[${type}] ${entry.name}`;
    });
    return { content: lines.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Search for pattern in files using ripgrep if available, fallback to Node.js
 */
async function grepSearch(
  pattern: string,
  dirPath: string,
): Promise<ToolResult> {
  // Try ripgrep first for better performance
  try {
    const { stdout } = await execShell(
      `rg --line-number --no-heading --smart-case "${pattern.replace(/"/g, '\\"')}" "${dirPath}"`,
    );
    // v8 ignore next
    return { content: stdout || 'No matches found' };
  } catch {
    // Ripgrep not available or failed, fallback to Node.js implementation
  }

  // Fallback: Node.js custom search
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }
    const regex = new RegExp(pattern, 'g');
    const results: string[] = [];

    function searchDirectory(currentPath: string) {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories and node_modules
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            searchDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(
                  `${fullPath}:${(i + 1).toString()}: ${lines[i].trim()}`,
                );
              }
              // Reset regex lastIndex for next line
              regex.lastIndex = 0;
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    searchDirectory(dirPath);

    if (!results.length) {
      return { content: 'No matches found' };
    }

    return { content: results.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * View specific line range from file
 */
function viewRange(filePath: string, start: number, end: number): ToolResult {
  try {
    if (!existsSync(filePath)) {
      return { content: '', error: `File not found: ${filePath}` };
    }
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Adjust for 1-indexed start/end
    const startIdx = Math.max(0, start - 1);
    const endIdx = Math.min(lines.length, end);

    if (startIdx >= lines.length || startIdx > endIdx) {
      return { content: '', error: 'Invalid line range' };
    }

    const selectedLines = lines.slice(startIdx, endIdx);
    return { content: selectedLines.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Failed to view range: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
