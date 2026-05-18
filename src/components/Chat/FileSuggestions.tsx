import { exec } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { useEffect, useMemo, useState } from 'react';

import { Suggestions } from '@/components/Suggestions';

const MENTION_PATTERN = /(^|.)@(\S+)/;
const RIPGREP_MAX_BUFFER = 10 * 1024 * 1024;

interface NextInput {
  value: string;
  cursorPosition: number;
}

interface Props {
  input: string;
  isDisabled?: boolean;
  onChange?: (nextInput: string | null) => void;
  onSelect: (nextInput: NextInput) => void;
}

interface MentionMatch {
  prefix: string;
  query: string;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function getMentionMatch(input: string): MentionMatch | null {
  const match = MENTION_PATTERN.exec(input);
  if (!match) {
    return null;
  }

  const prefix = input.slice(0, match.index + match[1].length);
  return {
    prefix,
    query: match[2],
  };
}

/**
 * Sort files alphabetically within each group:
 * 1. Non-dot files first
 * 2. Dot files second
 */
function sortFilePaths(left: string, right: string): number {
  const isDotLeft = left.split('/').some((segment) => segment.startsWith('.'));
  const isDotRight = right
    .split('/')
    .some((segment) => segment.startsWith('.'));

  if (isDotLeft !== isDotRight) {
    return isDotLeft ? 1 : -1;
  }

  return left.localeCompare(right);
}

export interface NextInputResult {
  value: string;
  cursorPosition: number;
}

export function buildNextInput(
  input: string,
  filePath: string,
): NextInputResult {
  const mentionMatch = getMentionMatch(input);
  // v8 ignore next 3
  if (!mentionMatch) {
    return { value: input, cursorPosition: input.length };
  }

  // Calculate what comes after the mention (preserve trailing text)
  const mentionEndIndex =
    mentionMatch.prefix.length + 1 + mentionMatch.query.length;
  const suffix = input.slice(mentionEndIndex);

  // Add space when: no suffix (for UX when typing after selection), or suffix doesn't start with whitespace
  const separator = !suffix.length || !/\s/.test(suffix[0]) ? ' ' : '';

  const value = `${mentionMatch.prefix}${filePath}${separator}${suffix}`;
  // Cursor position is right after the file path and separator
  const cursorPosition =
    mentionMatch.prefix.length + filePath.length + separator.length;

  return { value, cursorPosition };
}

function listProjectFilesFallback(rootDir: string): string[] {
  const filePaths: string[] = [];

  function walk(currentPath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git') {
        continue;
      }

      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        filePaths.push(normalizePath(relative(rootDir, fullPath)));
      }
    }
  }

  walk(rootDir);

  return filePaths.sort(sortFilePaths);
}

function listProjectFilesWithRipgrep(rootDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec(
      'rg --files --hidden -g "!**/.git/**"',
      { cwd: rootDir, maxBuffer: RIPGREP_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const filePaths = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map(normalizePath)
          .sort(sortFilePaths);

        resolve(filePaths);
      },
    );
  });
}

async function listProjectFiles(rootDir: string): Promise<string[]> {
  try {
    return await listProjectFilesWithRipgrep(rootDir);
  } catch {
    return listProjectFilesFallback(rootDir);
  }
}

export function FileSuggestions({
  input,
  isDisabled = false,
  onChange,
  onSelect,
}: Props) {
  const [filePaths, setFilePaths] = useState<string[]>([]);

  useEffect(() => {
    async function loadProjectFiles() {
      const nextFilePaths = await listProjectFiles(process.cwd());
      setFilePaths(nextFilePaths);
    }

    void loadProjectFiles();
  }, []);

  const mentionMatch = getMentionMatch(input);

  const options = useMemo(() => {
    if (!mentionMatch) {
      return [];
    }

    const normalizedQuery = mentionMatch.query.toLowerCase();
    return filePaths.filter((filePath) =>
      filePath.toLowerCase().includes(normalizedQuery),
    );
  }, [filePaths, mentionMatch]);

  useEffect(() => {
    if (!onChange) {
      return;
    }

    if (!mentionMatch || !options.length) {
      onChange(null);
    }
  }, [mentionMatch, onChange, options]);

  if (!mentionMatch || !options.length) {
    return null;
  }

  return (
    <Suggestions
      isDisabled={isDisabled}
      options={options.map((option) => ({ label: option, value: option }))}
      resetKey={input}
      onHighlight={(option) => {
        // v8 ignore next
        onChange?.(option ? buildNextInput(input, option.value).value : null);
      }}
      onSelect={(option) => {
        onSelect(buildNextInput(input, option.value));
      }}
    />
  );
}
