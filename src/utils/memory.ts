import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { CONFIG } from '@/constants';

const MEMORIES_DIRECTORY = join(CONFIG.DIRECTORY, 'memories');
const GLOBAL_MEMORY_DIRECTORY = join(MEMORIES_DIRECTORY, 'global');
const PROJECTS_MEMORY_DIRECTORY = join(MEMORIES_DIRECTORY, 'projects');
const MEMORY_FILE = 'MEMORY.md';
const METADATA_FILE = 'metadata.json';
const MAX_MEMORY_LINES = 200;
const MAX_MEMORY_BYTES = 25 * 1024;
const HASH_LENGTH = 12;

export interface ProjectMemoryIdentity {
  id: string;
  slug: string;
  hash: string;
  key: string;
  gitRoot: string;
  gitRemote?: string;
  directory: string;
}

export interface MemoryPaths {
  globalDirectory: string;
  globalMemoryPath: string;
  project: ProjectMemoryIdentity;
  projectMemoryPath: string;
  projectMetadataPath: string;
}

function runGit(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function normalizeRemote(remote: string): string {
  return remote
    .trim()
    .replace(/^ssh:\/\//, '')
    .replace(/^git@([^:]+):/, '$1/')
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function getRemoteSlug(remote: string): string {
  const normalized = normalizeRemote(remote);
  return basename(normalized) || 'project';
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'project';
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, HASH_LENGTH);
}

function resolveProjectIdentity(cwd = process.cwd()): ProjectMemoryIdentity {
  const gitRoot = runGit(['rev-parse', '--show-toplevel'], cwd) ?? cwd;
  const gitRemote = runGit(['config', '--get', 'remote.origin.url'], gitRoot);
  const key = gitRemote
    ? `remote:${normalizeRemote(gitRemote)}`
    : `path:${gitRoot}`;
  const slugSource = gitRemote ? getRemoteSlug(gitRemote) : basename(gitRoot);
  const slug = slugify(slugSource);
  const hash = hashKey(key);
  const id = `${slug}-${hash}`;
  const directory = join(PROJECTS_MEMORY_DIRECTORY, id);

  return {
    id,
    slug,
    hash,
    key,
    gitRoot,
    ...(gitRemote ? { gitRemote } : {}),
    directory,
  };
}

function readBoundedMarkdown(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf8');
    const boundedBytes = content.slice(0, MAX_MEMORY_BYTES);
    return boundedBytes
      .split('\n')
      .slice(0, MAX_MEMORY_LINES)
      .join('\n')
      .trim();
  } catch {
    return null;
  }
}

function ensureMemoryFile(path: string, title: string): void {
  if (existsSync(path)) {
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# ${title}\n\n`, 'utf8');
}

function writeProjectMetadata(paths: MemoryPaths): void {
  if (existsSync(paths.projectMetadataPath)) {
    return;
  }

  mkdirSync(paths.project.directory, { recursive: true });
  writeFileSync(
    paths.projectMetadataPath,
    JSON.stringify(
      {
        id: paths.project.id,
        name: paths.project.slug,
        gitRoot: paths.project.gitRoot,
        ...(paths.project.gitRemote
          ? { gitRemote: paths.project.gitRemote }
          : {}),
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}

export function getMemoryPaths(cwd = process.cwd()): MemoryPaths {
  const project = resolveProjectIdentity(cwd);

  return {
    globalDirectory: GLOBAL_MEMORY_DIRECTORY,
    globalMemoryPath: join(GLOBAL_MEMORY_DIRECTORY, MEMORY_FILE),
    project,
    projectMemoryPath: join(project.directory, MEMORY_FILE),
    projectMetadataPath: join(project.directory, METADATA_FILE),
  };
}

export function getMemoryPathSummary(cwd = process.cwd()): string {
  const paths = getMemoryPaths(cwd);

  return [
    `Global memory: ${paths.globalMemoryPath}`,
    `Project memory: ${paths.projectMemoryPath}`,
    `Project metadata: ${paths.projectMetadataPath}`,
  ].join('\n');
}

export function loadMemoryForPrompt(cwd = process.cwd()): string | null {
  const paths = getMemoryPaths(cwd);
  const globalMemory = readBoundedMarkdown(paths.globalMemoryPath);
  const projectMemory = readBoundedMarkdown(paths.projectMemoryPath);

  if (!globalMemory && !projectMemory) {
    return null;
  }

  return [
    'Loaded memory:',
    'These are durable user and project notes. Treat them as context, not hard configuration. Topic files referenced from MEMORY.md are not loaded unless you read them explicitly.',
    globalMemory ? `--- Global memory ---\n${globalMemory}` : '',
    projectMemory
      ? `--- Project memory (${paths.project.id}) ---\n${projectMemory}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function showMemory(cwd = process.cwd()): string {
  return (
    loadMemoryForPrompt(cwd) ?? `No memory found.\n${getMemoryPathSummary(cwd)}`
  );
}

export function appendMemory(
  text: string,
  options: { cwd?: string; scope?: 'global' | 'project' } = {},
): string {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Memory text is required.');
  }

  const paths = getMemoryPaths(options.cwd);
  const isGlobal = options.scope === 'global';
  const memoryPath = isGlobal
    ? paths.globalMemoryPath
    : paths.projectMemoryPath;

  ensureMemoryFile(memoryPath, isGlobal ? 'Global Memory' : 'Project Memory');

  if (!isGlobal) {
    writeProjectMetadata(paths);
  }

  appendFileSync(memoryPath, `- ${normalizedText}\n`, 'utf8');

  return memoryPath;
}

export const MEMORY_LIMITS = {
  maxLines: MAX_MEMORY_LINES,
  maxBytes: MAX_MEMORY_BYTES,
};

export const MEMORY_TEST_ONLY = {
  normalizeRemote,
  slugify,
  hashKey,
};
