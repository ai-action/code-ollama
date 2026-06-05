import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import ignore from 'ignore';

const RIPGREP_MAX_BUFFER = 10 * 1024 * 1024;
const GITIGNORE_FILE = '.gitignore';

interface ListFilesOptions {
  includeHidden?: boolean;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function hasHiddenSegment(filePath: string): boolean {
  return normalizePath(filePath)
    .split('/')
    .some((segment) => segment.startsWith('.'));
}

function listFilesWithRipgrep(
  rootDir: string,
  options: ListFilesOptions,
): Promise<string[]> {
  const args = ['--files'];

  if (options.includeHidden) {
    args.push('--hidden', '-g', '!**/.git/**');
  }

  return new Promise((resolve, reject) => {
    execFile(
      'rg',
      args,
      { cwd: rootDir, maxBuffer: RIPGREP_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(error instanceof Error ? error : new Error('Ripgrep failed'));
          return;
        }

        resolve(
          stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map(normalizePath),
        );
      },
    );
  });
}

async function createGitignoreFilter(rootDir: string) {
  const gitignorePath = join(rootDir, GITIGNORE_FILE);
  const filter = ignore();

  try {
    const content = await readFile(gitignorePath, 'utf8');
    filter.add(content);
  } catch {
    // .gitignore doesn't exist, use empty filter
  }

  return filter;
}

async function listFilesFallback(
  rootDir: string,
  options: ListFilesOptions,
): Promise<string[]> {
  const filter = await createGitignoreFilter(rootDir);
  const filePaths: string[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git') {
        continue;
      }

      const fullPath = join(currentPath, entry.name);
      const relativePath = normalizePath(relative(rootDir, fullPath));

      if (!options.includeHidden && hasHiddenSegment(relativePath)) {
        continue;
      }

      if (
        filter.ignores(entry.isDirectory() ? `${relativePath}/` : relativePath)
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        filePaths.push(relativePath);
      }
    }
  }

  await walk(rootDir);

  return filePaths;
}

export async function listDiscoveredFiles(
  rootDir: string,
  options: ListFilesOptions = {},
): Promise<string[]> {
  try {
    return await listFilesWithRipgrep(rootDir, options);
  } catch {
    return listFilesFallback(rootDir, options);
  }
}

/**
 * Sort files alphabetically within each group:
 * 1. Non-dot files first
 * 2. Dot files second
 */
export function sortFilePaths(left: string, right: string): number {
  const isDotLeft = hasHiddenSegment(left);
  const isDotRight = hasHiddenSegment(right);

  if (isDotLeft !== isDotRight) {
    return isDotLeft ? 1 : -1;
  }

  return left.localeCompare(right);
}
