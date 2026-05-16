import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { execShell } from './shell';

/**
 * Read file contents
 */
export function readFile(filePath: string): ToolResult {
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
export function writeFile(filePath: string, content: string): ToolResult {
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
export function editFile(
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

/**
 * View specific line range from file
 */
export function viewRange(
  filePath: string,
  start: number,
  end: number,
): ToolResult {
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

/**
 * List directory contents
 */
export function listDir(dirPath: string): ToolResult {
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
export async function grepSearch(
  pattern: string,
  dirPath: string,
): Promise<ToolResult> {
  // Try ripgrep first for better performance
  try {
    const escapedPattern = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedDirPath = dirPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const { stdout } = await execShell(
      `rg --line-number --no-heading --smart-case "${escapedPattern}" "${escapedDirPath}"`,
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
