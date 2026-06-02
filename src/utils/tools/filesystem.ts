import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { execShell } from './shell';

const DIFF_CONTEXT_LINES = 3;
const DIFF_MAX_LINES = 120;
const DIFF_MAX_CHARS = 12_000;

function splitLines(content: string): string[] {
  return content.split('\n');
}

function createUnifiedDiff(
  filePath: string,
  beforeContent: string,
  afterContent: string,
): string {
  const beforeLines = splitLines(beforeContent);
  const afterLines = splitLines(afterContent);

  let commonPrefix = 0;
  while (
    commonPrefix < beforeLines.length &&
    commonPrefix < afterLines.length &&
    beforeLines[commonPrefix] === afterLines[commonPrefix]
  ) {
    commonPrefix += 1;
  }

  let commonSuffix = 0;
  while (
    commonSuffix < beforeLines.length - commonPrefix &&
    commonSuffix < afterLines.length - commonPrefix &&
    beforeLines[beforeLines.length - 1 - commonSuffix] ===
      afterLines[afterLines.length - 1 - commonSuffix]
  ) {
    commonSuffix += 1;
  }

  const beforeChangeEnd = beforeLines.length - commonSuffix;
  const afterChangeEnd = afterLines.length - commonSuffix;
  const hunkStart = Math.max(0, commonPrefix - DIFF_CONTEXT_LINES);
  const beforeHunkEnd = Math.min(
    beforeLines.length,
    beforeChangeEnd + DIFF_CONTEXT_LINES,
  );
  const afterHunkEnd = Math.min(
    afterLines.length,
    afterChangeEnd + DIFF_CONTEXT_LINES,
  );

  const beforeHunkLines = beforeLines.slice(hunkStart, beforeHunkEnd);
  const afterHunkLines = afterLines.slice(hunkStart, afterHunkEnd);
  const beforeChangedLines = beforeLines.slice(commonPrefix, beforeChangeEnd);
  const afterChangedLines = afterLines.slice(commonPrefix, afterChangeEnd);
  const contextBefore = beforeLines.slice(hunkStart, commonPrefix);
  const contextAfter = beforeLines.slice(beforeChangeEnd, beforeHunkEnd);

  const lines = [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    `@@ -${String(hunkStart + 1)},${String(beforeHunkLines.length)} +${String(hunkStart + 1)},${String(afterHunkLines.length)} @@`,
    ...contextBefore.map((line) => ` ${line}`),
    ...beforeChangedLines.map((line) => `-${line}`),
    ...afterChangedLines.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`),
  ];

  return lines.join('\n');
}

function truncateDiff(diff: string): {
  visible: string;
  truncated: boolean;
  totalLines: number;
  visibleLines: number;
} {
  const lines = diff.split('\n');
  let visibleLines = lines.slice(0, DIFF_MAX_LINES);
  let truncated = lines.length > DIFF_MAX_LINES;

  while (visibleLines.join('\n').length > DIFF_MAX_CHARS) {
    visibleLines = visibleLines.slice(0, -1);
    truncated = true;
  }

  if (truncated) {
    visibleLines = [
      ...visibleLines,
      `[diff truncated: showing ${String(visibleLines.length)} of ${String(lines.length)} lines]`,
    ];
  }

  return {
    visible: visibleLines.join('\n'),
    truncated,
    totalLines: lines.length,
    visibleLines: Math.min(visibleLines.length, lines.length),
  };
}

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
    const fullDiff = createUnifiedDiff(filePath, content, updatedContent);
    const truncatedDiff = truncateDiff(fullDiff);
    writeFileSync(filePath, updatedContent, 'utf8');

    return {
      content: `File edited successfully: ${filePath}`,
      diff: {
        path: filePath,
        visible: truncatedDiff.visible,
        truncated: truncatedDiff.truncated,
        totalLines: truncatedDiff.totalLines,
        visibleLines: truncatedDiff.visibleLines,
      },
    };
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
