import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { ToolResult } from '@/types';

import { execFile } from '../../node';
import { listDiscoveredFiles } from './discovery';

const RIPGREP_EXEC_OPTIONS = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024,
};

/**
 * ripgrep exits with 1 when the pattern is valid but matched nothing. Every
 * other failure (missing binary, unsupported pattern syntax, timeout) means
 * ripgrep never completed the search.
 */
function isNoMatchesExit(error: unknown): boolean {
  const code = (error as { code?: number | string } | null)?.code;
  return code === 1;
}

const MAX_PATTERN_LENGTH = 256;
const MAX_LINE_LENGTH = 2_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_RESULTS = 500;
const FALLBACK_TIMEOUT_MS = 10_000;
const BINARY_SNIFF_CHARS = 8_192;
const FILES_PER_YIELD = 20;

/** Matches a group that backtracks catastrophically, such as `(a+)+`. */
const NESTED_QUANTIFIER =
  /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,\})/;

/** Matches an alternation of one repeated atom, such as `(a|a)*`. */
const REPEATED_ALTERNATION = /\(([^()|\\])\|\1\)\s*(?:[+*]|\{\d+,\})/;

type LineMatcher = (line: string) => boolean;

/**
 * Detect patterns whose worst-case cost is exponential in the input line.
 *
 * This is a heuristic, not a proof: it misses nested groups and overlapping
 * alternations such as `(a|ab)*`. The length caps below are the primary
 * defence, so a false negative costs time rather than a hang.
 */
function isUnsafeRegex(pattern: string): boolean {
  return NESTED_QUANTIFIER.test(pattern) || REPEATED_ALTERNATION.test(pattern);
}

/**
 * Build a line matcher, degrading to a literal substring search when the
 * pattern is oversized or backtracks catastrophically. Degrading rather than
 * rejecting keeps the tool useful without reintroducing unbounded work.
 */
function createMatcher(pattern: string): LineMatcher {
  if (pattern.length > MAX_PATTERN_LENGTH || isUnsafeRegex(pattern)) {
    return (line) => line.includes(pattern);
  }

  const regex = new RegExp(pattern);
  return (line) => regex.test(line);
}

function looksBinary(content: string): boolean {
  return content.slice(0, BINARY_SNIFF_CHARS).includes('\u0000');
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function readSearchableFile(
  filePath: string,
): Promise<string | undefined> {
  try {
    const stats = await stat(filePath);

    if (!stats.isFile() || stats.size > MAX_FILE_BYTES) {
      return undefined;
    }

    const content = await readFile(filePath, 'utf8');
    return looksBinary(content) ? undefined : content;
  } catch {
    // Skip files that can't be read
    return undefined;
  }
}

/**
 * Search without ripgrep. Only reachable when ripgrep is unavailable, cannot
 * parse the pattern, or times out.
 *
 * Uses the same gitignore-aware discovery as `find_files` so both tools agree
 * on which files exist. ripgrep additionally honours nested `.gitignore`,
 * `.ignore` and `.rgignore` files, which this fallback does not, so results
 * here can be slightly broader.
 */
async function searchWithoutRipgrep(
  patterns: string[],
  dirPath: string,
): Promise<ToolResult> {
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }

    const matchers = patterns.map(createMatcher);
    const filePaths = await listDiscoveredFiles(dirPath);
    const results: string[] = [];
    const deadline = Date.now() + FALLBACK_TIMEOUT_MS;
    let truncated = false;
    let filesSinceYield = 0;

    for (const relativePath of filePaths) {
      if (results.length >= MAX_RESULTS || Date.now() > deadline) {
        truncated = true;
        break;
      }

      if (++filesSinceYield >= FILES_PER_YIELD) {
        filesSinceYield = 0;
        await yieldToEventLoop();

        if (Date.now() > deadline) {
          truncated = true;
          break;
        }
      }

      const fullPath = join(dirPath, relativePath);
      const content = await readSearchableFile(fullPath);

      if (content === undefined) {
        continue;
      }

      const lines = content.split('\n');

      for (const [index, line] of lines.entries()) {
        if (line.length > MAX_LINE_LENGTH) {
          continue;
        }

        if (matchers.some((matches) => matches(line))) {
          results.push(`${fullPath}:${(index + 1).toString()}: ${line.trim()}`);

          if (results.length >= MAX_RESULTS) {
            truncated = true;
            break;
          }
        }
      }

      if (truncated) {
        break;
      }
    }

    if (!results.length) {
      return { content: 'No matches found' };
    }

    if (truncated) {
      results.push(
        `[search truncated: reached the limit of ${String(MAX_RESULTS)} results or ${String(FALLBACK_TIMEOUT_MS)}ms]`,
      );
    }

    return { content: results.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

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
 * Search for a pattern in files using ripgrep, falling back to a bounded
 * Node.js search when ripgrep is unavailable or cannot run the pattern.
 */
export async function grepSearch(
  pattern: string,
  dirPath: string,
): Promise<ToolResult> {
  const patterns = buildSearchPatterns(pattern);

  // Try ripgrep first for better performance
  let shouldFallBackToNode = false;

  for (const searchPattern of patterns) {
    try {
      const { stdout } = await execFile(
        'rg',
        [
          '--line-number',
          '--no-heading',
          '--smart-case',
          '--',
          searchPattern,
          dirPath,
        ],
        RIPGREP_EXEC_OPTIONS,
      );

      if (stdout) {
        return { content: stdout };
      }
    } catch (error) {
      // A valid pattern that matched nothing still leaves the remaining case
      // variants worth trying. Anything else means ripgrep could not search
      // at all, so the Node.js implementation has to take over.
      if (!isNoMatchesExit(error)) {
        shouldFallBackToNode = true;
        break;
      }
    }
  }

  // ripgrep searched every variant and found nothing: repeating the same scan
  // in Node.js would walk the tree again and cannot produce new matches.
  if (!shouldFallBackToNode) {
    return { content: 'No matches found' };
  }

  return searchWithoutRipgrep(patterns, dirPath);
}
