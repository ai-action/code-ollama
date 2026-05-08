import { exec } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useState } from 'react';

const MAX_VISIBLE_OPTIONS = 5;
const MENTION_PATTERN = /(^|\s)@(\S+)$/;

interface Props {
  input: string;
  isDisabled?: boolean;
  onSelect: (nextInput: string) => void;
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

function buildNextInput(input: string, filePath: string): string {
  const mentionMatch = getMentionMatch(input);
  // v8 ignore next 3
  if (!mentionMatch) {
    return input;
  }

  return `${mentionMatch.prefix}${filePath} `;
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

  return filePaths.sort((left, right) => left.localeCompare(right));
}

function listProjectFilesWithRipgrep(rootDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec(
      'rg --files --hidden -g "!**/.git/**"',
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
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
          .sort((left, right) => left.localeCompare(right));

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
  onSelect,
}: Props) {
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadProjectFiles() {
      const nextFilePaths = await listProjectFiles(process.cwd());
      if (isMounted) {
        setFilePaths(nextFilePaths);
      }
    }

    void loadProjectFiles();

    return () => {
      isMounted = false;
    };
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
    setFocusedIndex(0);
  }, [input]);

  useEffect(() => {
    if (!options.length) {
      setFocusedIndex(0);
      return;
    }

    setFocusedIndex((currentIndex) =>
      Math.min(currentIndex, options.length - 1),
    );
  }, [options]);

  useInput((_, key) => {
    if (isDisabled || !options.length) {
      return;
    }

    if (key.downArrow) {
      setFocusedIndex((currentIndex) =>
        Math.min(currentIndex + 1, options.length - 1),
      );
      return;
    }

    if (key.upArrow) {
      setFocusedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (key.tab) {
      onSelect(buildNextInput(input, options[focusedIndex]));
    }
  });

  if (!mentionMatch || !options.length) {
    return null;
  }

  const visibleStart = Math.min(
    Math.max(0, focusedIndex - MAX_VISIBLE_OPTIONS + 1),
    Math.max(0, options.length - MAX_VISIBLE_OPTIONS),
  );
  const visibleOptions = options.slice(
    visibleStart,
    visibleStart + MAX_VISIBLE_OPTIONS,
  );

  return (
    <Box flexDirection="column">
      {visibleOptions.map((option, index) => {
        const optionIndex = visibleStart + index;
        const isFocused = optionIndex === focusedIndex;

        return (
          <Box key={option} marginLeft={2}>
            <Text color={isFocused ? 'cyan' : undefined}>{option}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
