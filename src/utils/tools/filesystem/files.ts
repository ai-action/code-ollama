import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import type { ToolResult } from '@/types';

import { createUnifiedDiff, truncateDiff } from './diff';

const READ_FILE_MAX_CHARS = 50_000;

interface ReadFileOptions {
  startLine?: number;
  endLine?: number;
  maxLines?: number;
  maxChars?: number;
}

function formatNumberedLines(lines: string[], startLine: number): string {
  return lines
    .map((line, index) => `${String(startLine + index)}: ${line}`)
    .join('\n');
}

/**
 * Read file contents
 */
export function readFile(
  filePath: string,
  options: ReadFileOptions = {},
): ToolResult {
  try {
    if (!existsSync(filePath)) {
      return { content: '', error: `File not found: ${filePath}` };
    }

    const content = readFileSync(filePath, 'utf8');
    const isPartialRead =
      options.startLine !== undefined ||
      options.endLine !== undefined ||
      options.maxLines !== undefined;

    let output: string;

    if (!isPartialRead) {
      output = content;
    } else {
      const lines = content.split('\n');
      const startLine = options.startLine ?? 1;
      const endLine =
        options.endLine ?? startLine + (options.maxLines ?? lines.length) - 1;
      const startIndex = startLine - 1;
      const endIndex = Math.min(lines.length, endLine);

      if (startIndex >= lines.length) {
        return { content: '', error: 'Invalid line range' };
      }

      const selectedLines = lines.slice(startIndex, endIndex);
      output = formatNumberedLines(selectedLines, startLine);
    }

    const cap = options.maxChars ?? READ_FILE_MAX_CHARS;
    if (output.length > cap) {
      return {
        content: `${output.slice(0, cap)}\n[file truncated: showing ${String(cap)} of ${String(output.length)} chars]`,
      };
    }

    return { content: output };
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
    let content: string;

    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      return { content: '', error: `File not found: ${filePath}` };
    }

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
