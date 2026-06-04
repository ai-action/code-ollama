import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

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
