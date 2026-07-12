import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const mockConfig = vi.hoisted(() => ({
  directory: `/tmp/code-ollama-memory-test-${String(Date.now())}`,
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('@/constants', () => ({
  CONFIG: {
    DIRECTORY: mockConfig.directory,
  },
}));

describe('memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rmSync(mockConfig.directory, { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(mockConfig.directory, { recursive: true, force: true });
  });

  it('uses the normalized git remote for stable project ids', async () => {
    vi.mocked(execFileSync).mockImplementation((command, args, options) => {
      const gitArgs = args as string[];
      const cwd = (options as { cwd: string }).cwd;

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return cwd.includes('moved')
          ? '/Users/mark/moved/code-ollama\n'
          : '/Users/mark/Code/npm/code-ollama\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'git@github.com:owner/code-ollama.git\n';
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const { getMemoryPaths } = await import('./memory');

    const first = getMemoryPaths('/Users/mark/Code/npm/code-ollama');
    const moved = getMemoryPaths('/Users/mark/moved/code-ollama');

    expect(first.project.id).toBe(moved.project.id);
    expect(first.project.id).toMatch(/^code-ollama-[a-f0-9]{12}$/);
    expect(first.project.key).toBe('remote:github.com/owner/code-ollama');
  });

  it('falls back to the git root path when no remote exists', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args, options) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return `${(options as { cwd: string }).cwd}\n`;
      }

      throw new Error('no remote');
    });

    const { getMemoryPaths } = await import('./memory');

    const first = getMemoryPaths('/tmp/one/api');
    const second = getMemoryPaths('/tmp/two/api');

    expect(first.project.id).toMatch(/^api-[a-f0-9]{12}$/);
    expect(second.project.id).toMatch(/^api-[a-f0-9]{12}$/);
    expect(first.project.id).not.toBe(second.project.id);
    expect(first.project.key).toBe('path:/tmp/one/api');
  });

  it('loads only bounded global and project memory', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'https://github.com/owner/repo.git\n';
      }

      throw new Error('unexpected git command');
    });

    const { getMemoryPaths, loadMemoryForPrompt, MEMORY_LIMITS } =
      await import('./memory');
    const paths = getMemoryPaths('/repo');

    mkdirSync(paths.globalDirectory, { recursive: true });
    mkdirSync(paths.project.directory, { recursive: true });
    writeFileSync(paths.globalMemoryPath, 'global fact\n', 'utf8');
    const projectContent = Array.from(
      { length: MEMORY_LIMITS.maxLines + 1 },
      (_, index) => `project line ${String(index + 1)}`,
    ).join('\n');
    writeFileSync(paths.projectMemoryPath, projectContent, 'utf8');

    const prompt = loadMemoryForPrompt('/repo') ?? '';

    expect(prompt).toContain('Loaded memory:');
    expect(prompt).toContain('global fact');
    expect(prompt).toContain('project line 200');
    expect(prompt).not.toContain('project line 201');
  });

  it('falls back to project slug when remote basename is empty', async () => {
    const { MEMORY_TEST_ONLY } = await import('./memory');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('git not found');
    });

    expect(MEMORY_TEST_ONLY.slugify('---')).toBe('project');
  });

  it('falls back to project slug when remote normalizes to an empty basename', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'ssh:///\n';
      }

      throw new Error('unexpected git command');
    });

    const { getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    expect(paths.project.slug).toBe('project');
  });

  it('falls back to cwd when git is not available', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('git not found');
    });

    const { getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/no-git-here');

    expect(paths.project.gitRoot).toBe('/no-git-here');
    expect(paths.project.key).toBe('path:/no-git-here');
  });

  it('returns scoped memory details', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      if ((args as string[]).join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }
      throw new Error('no remote');
    });
    const { getMemoryDetails, getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/repo');
    mkdirSync(paths.project.directory, { recursive: true });
    writeFileSync(paths.projectMemoryPath, '# Project Memory\n\n- Note\n');

    expect(getMemoryDetails('project', '/repo')).toEqual({
      content: '# Project Memory\n\n- Note\n',
      exists: true,
      path: paths.projectMemoryPath,
      scope: 'project',
    });
    expect(getMemoryDetails('global', '/repo')).toEqual({
      content: null,
      exists: false,
      path: paths.globalMemoryPath,
      scope: 'global',
    });
  });

  it('deletes only the scoped memory file and retains project metadata', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      if ((args as string[]).join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }
      throw new Error('no remote');
    });
    const { deleteMemory, getMemoryPaths, saveMemory } =
      await import('./memory');
    const paths = getMemoryPaths('/repo');
    saveMemory('Note', { cwd: '/repo' });

    expect(deleteMemory('project', '/repo')).toBe(true);
    expect(existsSync(paths.projectMemoryPath)).toBe(false);
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
    expect(deleteMemory('project', '/repo')).toBe(false);
  });

  it('returns null when neither global nor project memory file exists', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { loadMemoryForPrompt } = await import('./memory');
    expect(loadMemoryForPrompt('/repo')).toBeNull();
  });

  it('showMemory returns fallback message when no memory files exist', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { showMemory } = await import('./memory');
    const result = showMemory('/repo');

    expect(result).toBe('No memory found.');
  });

  it('does not create a memory file when empty content is saved', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    expect(saveMemory('   ', { cwd: '/repo' })).toEqual({
      path: paths.projectMemoryPath,
      status: 'unchanged',
    });
    expect(existsSync(paths.projectMemoryPath)).toBe(false);
  });

  it('deletes an existing memory file when empty content is saved', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      if ((args as string[]).join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }
      throw new Error('no remote');
    });
    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');
    saveMemory('Note', { cwd: '/repo' });

    expect(saveMemory('', { cwd: '/repo' })).toEqual({
      path: paths.projectMemoryPath,
      status: 'deleted',
    });
    expect(existsSync(paths.projectMemoryPath)).toBe(false);
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
  });

  it('renders only global memory when project memory is absent', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { getMemoryPaths, loadMemoryForPrompt } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    mkdirSync(paths.globalDirectory, { recursive: true });
    writeFileSync(paths.globalMemoryPath, 'global only\n', 'utf8');

    const result = loadMemoryForPrompt('/repo') ?? '';

    expect(result).toContain('global only');
    expect(result).not.toContain('Project memory');
  });

  it('renders only project memory when global memory is absent', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'https://github.com/owner/repo.git\n';
      }

      throw new Error('unexpected git command');
    });

    const { getMemoryPaths, loadMemoryForPrompt } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    mkdirSync(paths.project.directory, { recursive: true });
    writeFileSync(paths.projectMemoryPath, 'project only\n', 'utf8');

    const result = loadMemoryForPrompt('/repo') ?? '';

    expect(result).toContain('project only');
    expect(result).not.toContain('Global memory');
  });

  it('writes metadata without gitRemote when no remote is configured', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    saveMemory('Local note.', { cwd: '/repo' });

    const metadata = JSON.parse(
      readFileSync(paths.projectMetadataPath, 'utf8'),
    ) as Record<string, unknown>;

    expect(metadata).not.toHaveProperty('gitRemote');
    expect(metadata).toHaveProperty('gitRoot', '/repo');
  });

  it('returns null from readBoundedMarkdown when file is unreadable', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { getMemoryPaths, loadMemoryForPrompt } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    mkdirSync(paths.globalDirectory, { recursive: true });
    writeFileSync(paths.globalMemoryPath, 'global fact\n', 'utf8');
    chmodSync(paths.globalMemoryPath, 0);

    expect(loadMemoryForPrompt('/repo')).toBeNull();

    chmodSync(paths.globalMemoryPath, 0o644);
  });

  it('overwrites memory without adding headings or list markers', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'https://github.com/owner/repo.git\n';
      }

      throw new Error('unexpected git command');
    });

    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    saveMemory('First note.', { cwd: '/repo' });
    saveMemory('Second note.', { cwd: '/repo' });
    saveMemory('First global.', { cwd: '/repo', scope: 'global' });
    saveMemory('Second global.', { cwd: '/repo', scope: 'global' });

    expect(readFileSync(paths.projectMemoryPath, 'utf8')).toBe('Second note.');
    expect(readFileSync(paths.globalMemoryPath, 'utf8')).toBe('Second global.');
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
  });

  it('saves project and global memory lazily', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      if (gitArgs.join(' ') === 'config --get remote.origin.url') {
        return 'https://github.com/owner/repo.git\n';
      }

      throw new Error('unexpected git command');
    });

    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    saveMemory('Use Vitest.', { cwd: '/repo' });
    saveMemory('Prefer small changes.', { cwd: '/repo', scope: 'global' });

    expect(readFileSync(paths.projectMemoryPath, 'utf8')).toBe('Use Vitest.');
    expect(readFileSync(paths.globalMemoryPath, 'utf8')).toBe(
      'Prefer small changes.',
    );
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
  });

  it('cleans up the temporary file when renaming fails', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      if ((args as string[]).join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }
      throw new Error('no remote');
    });

    const { getMemoryPaths, saveMemory } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    mkdirSync(paths.project.directory, { recursive: true });
    mkdirSync(paths.projectMemoryPath);

    expect(() => saveMemory('Note', { cwd: '/repo' })).toThrow();

    const tempFiles = readdirSync(paths.project.directory).filter((file) =>
      file.endsWith('.tmp'),
    );
    expect(tempFiles).toHaveLength(0);
  });
});
