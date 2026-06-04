import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { execShell } from './shell';

const DIFF_CONTEXT_LINES = 3;
const DIFF_MAX_LINES = 120;
const DIFF_MAX_CHARS = 12_000;

export const DEFAULT_FIND_FILES_IGNORED_DIRS = [
  'node_modules',
  '__pycache__',
  '.*cache',
  '.tox',
  '.venv',
  'venv',
  'dist',
  'build',
  'coverage',
] as const;

interface FindFilesOptions {
  pattern?: string;
  includeHidden?: boolean;
  ignoredDirs?: readonly string[];
}

interface ReadFileOptions {
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}

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

function buildSearchPatterns(pattern: string): string[] {
  const words = pattern
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (words.length < 2) {
    return [pattern];
  }

  const camelCase = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase()),
    )
    .join('');
  const pascalCase = words
    .map((word) => capitalize(word.toLowerCase()))
    .join('');
  const snakeCase = words.map((word) => word.toLowerCase()).join('_');
  const upperSnakeCase = snakeCase.toUpperCase();
  const flexibleWhitespace = words.join(String.raw`\s+`);

  return Array.from(
    new Set([
      pattern,
      flexibleWhitespace,
      snakeCase,
      upperSnakeCase,
      camelCase,
      pascalCase,
    ]),
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileMatchesPattern(filePath: string, pattern?: string): boolean {
  const trimmedPattern = pattern?.trim();
  if (!trimmedPattern) {
    return true;
  }

  const normalizedPath = filePath.toLowerCase();
  const normalizedFileName = normalizedPath.slice(
    Math.max(
      normalizedPath.lastIndexOf('/'),
      normalizedPath.lastIndexOf('\\'),
    ) + 1,
  );
  const normalizedPattern = trimmedPattern.toLowerCase();

  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    return normalizedPath.includes(normalizedPattern);
  }

  const regexPattern = normalizedPattern
    .split('')
    .map((char) => {
      if (char === '*') {
        return '.*';
      }

      if (char === '?') {
        return '.';
      }

      return escapeRegExp(char);
    })
    .join('');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath) || regex.test(normalizedFileName);
}

function valueMatchesWildcardPattern(value: string, pattern: string): boolean {
  const normalizedValue = value.toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();

  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    return normalizedValue === normalizedPattern;
  }

  const regexPattern = normalizedPattern
    .split('')
    .map((char) => {
      if (char === '*') {
        return '.*';
      }

      if (char === '?') {
        return '.';
      }

      return escapeRegExp(char);
    })
    .join('');

  return new RegExp(`^${regexPattern}$`).test(normalizedValue);
}

function directoryMatchesIgnoredPattern(
  dirName: string,
  ignoredDirs: ReadonlySet<string>,
): boolean {
  for (const ignoredDir of ignoredDirs) {
    if (valueMatchesWildcardPattern(dirName, ignoredDir)) {
      return true;
    }
  }

  return false;
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

    if (!isPartialRead) {
      return { content };
    }

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
    return { content: formatNumberedLines(selectedLines, startLine) };
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

/**
 * Create a directory and any missing parent directories
 */
export function createDirectory(dirPath: string): ToolResult {
  try {
    if (existsSync(dirPath)) {
      if (statSync(dirPath).isDirectory()) {
        return { content: `Directory already exists: ${dirPath}` };
      }

      return {
        content: '',
        error: `Path already exists and is not a directory: ${dirPath}`,
      };
    }

    mkdirSync(dirPath, { recursive: true });
    return { content: `Directory created successfully: ${dirPath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Rename or move an existing file or directory
 */
export function renamePath(fromPath: string, toPath: string): ToolResult {
  try {
    if (!existsSync(fromPath)) {
      return { content: '', error: `Source path not found: ${fromPath}` };
    }

    if (existsSync(toPath)) {
      return {
        content: '',
        error: `Destination path already exists: ${toPath}`,
      };
    }

    renameSync(fromPath, toPath);
    return { content: `Path renamed successfully: ${fromPath} -> ${toPath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to rename path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Delete a file or directory
 */
export function deletePath(path: string, recursive: boolean): ToolResult {
  try {
    if (!existsSync(path)) {
      return { content: '', error: `Path not found: ${path}` };
    }

    const stats = statSync(path);
    if (stats.isDirectory()) {
      const entries = readdirSync(path);
      if (entries.length > 0 && !recursive) {
        return {
          content: '',
          error: `Directory is not empty; set recursive to true to delete: ${path}`,
        };
      }

      if (recursive) {
        rmSync(path, { recursive: true, force: false });
      } else {
        rmdirSync(path);
      }
    } else {
      rmSync(path, { force: false });
    }

    return { content: `Path deleted successfully: ${path}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to delete path: ${error instanceof Error ? error.message : String(error)}`,
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
 * Recursively find files by path
 */
export function findFiles(
  dirPath: string,
  options: FindFilesOptions = {},
): ToolResult {
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }

    if (!statSync(dirPath).isDirectory()) {
      return { content: '', error: `Path is not a directory: ${dirPath}` };
    }

    const results: string[] = [];
    const includeHidden = options.includeHidden ?? false;
    const ignoredDirs = new Set(
      options.ignoredDirs ?? DEFAULT_FIND_FILES_IGNORED_DIRS,
    );

    function searchDirectory(currentPath: string) {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (
            entry.name !== '.git' &&
            !directoryMatchesIgnoredPattern(entry.name, ignoredDirs) &&
            (includeHidden || !entry.name.startsWith('.'))
          ) {
            searchDirectory(fullPath);
          }
        } else if (
          entry.isFile() &&
          (includeHidden || !entry.name.startsWith('.')) &&
          fileMatchesPattern(fullPath, options.pattern)
        ) {
          results.push(fullPath);
        }
      }
    }

    searchDirectory(dirPath);

    return { content: results.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
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
  const patterns = buildSearchPatterns(pattern);

  // Try ripgrep first for better performance
  for (const searchPattern of patterns) {
    try {
      const escapedPattern = searchPattern
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const escapedDirPath = dirPath
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

      const { stdout } = await execShell(
        `rg --line-number --no-heading --smart-case "${escapedPattern}" "${escapedDirPath}"`,
      );

      if (stdout) {
        return { content: stdout };
      }
    } catch {
      // Ripgrep not available, pattern invalid, or no matches found
    }
  }

  // Fallback: Node.js custom search
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }
    const regexes = patterns.map((searchPattern) => new RegExp(searchPattern));
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
              for (const regex of regexes) {
                if (regex.test(lines[i])) {
                  results.push(
                    `${fullPath}:${(i + 1).toString()}: ${lines[i].trim()}`,
                  );
                  break;
                }
              }
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
