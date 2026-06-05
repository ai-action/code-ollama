import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { listDiscoveredFiles } from './discovery';

interface FindFilesOptions {
  pattern?: string;
  includeHidden?: boolean;
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

/**
 * Recursively find files by path
 */
export async function findFiles(
  dirPath: string,
  options: FindFilesOptions = {},
): Promise<ToolResult> {
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }

    if (!statSync(dirPath).isDirectory()) {
      return { content: '', error: `Path is not a directory: ${dirPath}` };
    }

    const results = (
      await listDiscoveredFiles(dirPath, {
        includeHidden: options.includeHidden,
      })
    )
      .map((filePath) => join(dirPath, filePath))
      .filter((filePath) => fileMatchesPattern(filePath, options.pattern));

    return { content: results.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
