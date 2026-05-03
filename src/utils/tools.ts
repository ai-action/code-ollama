import { exec } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Tool definitions for Ollama API
export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the specified path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to read',
          },
        },
        required: ['path'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file at the specified path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to write',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'run_shell',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
        },
        required: ['command'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List the contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the directory to list',
          },
        },
        required: ['path'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'grep_search',
      description: 'Search for a pattern in files within a directory',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The regex pattern to search for',
          },
          path: {
            type: 'string',
            description: 'The directory path to search in',
          },
        },
        required: ['pattern', 'path'],
      },
    },
  },

  {
    type: 'function' as const,
    function: {
      name: 'view_range',
      description: 'View a specific range of lines from a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file',
          },
          start: {
            type: 'number',
            description: 'The starting line number (1-indexed)',
          },
          end: {
            type: 'number',
            description: 'The ending line number (inclusive)',
          },
        },
        required: ['path', 'start', 'end'],
      },
    },
  },
];

// Tools that require approval in smart mode
export const TOOLS_REQUIRING_APPROVAL = new Set(['write_file', 'run_shell']);

// Tool execution result
export interface ToolExecutionResult {
  content: string;
  error?: string;
}

/**
 * Execute a tool by name with arguments
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  switch (name) {
    case 'read_file':
      return readFile(args.path as string);
    case 'write_file':
      return writeFile(args.path as string, args.content as string);
    case 'run_shell':
      return runShell(args.command as string);
    case 'list_dir':
      return listDir(args.path as string);
    case 'grep_search':
      return await grepSearch(args.pattern as string, args.path as string);
    case 'view_range':
      return viewRange(
        args.path as string,
        args.start as number,
        args.end as number,
      );
    default:
      return { content: '', error: `Unknown tool: ${name}` };
  }
}

/**
 * Read file contents
 */
function readFile(filePath: string): ToolExecutionResult {
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
function writeFile(filePath: string, content: string): ToolExecutionResult {
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
async function runShell(command: string): Promise<ToolExecutionResult> {
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
function listDir(dirPath: string): ToolExecutionResult {
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
): Promise<ToolExecutionResult> {
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

    if (results.length === 0) {
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
function viewRange(
  filePath: string,
  start: number,
  end: number,
): ToolExecutionResult {
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
