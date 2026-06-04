import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { execShell } from '../shell';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
