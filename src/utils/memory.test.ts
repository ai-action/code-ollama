import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
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

  it('returns a path summary string', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { getMemoryPathSummary } = await import('./memory');
    const summary = getMemoryPathSummary('/repo');

    expect(summary).toContain('Global memory:');
    expect(summary).toContain('Project memory:');
    expect(summary).not.toContain('Project metadata:');
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

    expect(result).toContain('No memory found.');
    expect(result).toContain('Global memory:');
  });

  it('throws when appendMemory is called with empty text', async () => {
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const gitArgs = args as string[];

      if (gitArgs.join(' ') === 'rev-parse --show-toplevel') {
        return '/repo\n';
      }

      throw new Error('no remote');
    });

    const { appendMemory } = await import('./memory');

    expect(() => appendMemory('   ')).toThrow('Memory text is required.');
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

    const { appendMemory, getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    appendMemory('Local note.', { cwd: '/repo' });

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

  it('ensureMemoryFile and writeProjectMetadata are idempotent on second append', async () => {
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

    const { appendMemory, getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    appendMemory('First note.', { cwd: '/repo' });
    appendMemory('Second note.', { cwd: '/repo' });
    appendMemory('First global.', { cwd: '/repo', scope: 'global' });
    appendMemory('Second global.', { cwd: '/repo', scope: 'global' });

    expect(readFileSync(paths.projectMemoryPath, 'utf8')).toContain(
      '- Second note.',
    );
    expect(readFileSync(paths.globalMemoryPath, 'utf8')).toContain(
      '- Second global.',
    );
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
  });

  it('appends project and global memory lazily', async () => {
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

    const { appendMemory, getMemoryPaths } = await import('./memory');
    const paths = getMemoryPaths('/repo');

    appendMemory('Use Vitest.', { cwd: '/repo' });
    appendMemory('Prefer small changes.', { cwd: '/repo', scope: 'global' });

    expect(readFileSync(paths.projectMemoryPath, 'utf8')).toContain(
      '- Use Vitest.',
    );
    expect(readFileSync(paths.globalMemoryPath, 'utf8')).toContain(
      '- Prefer small changes.',
    );
    expect(existsSync(paths.projectMetadataPath)).toBe(true);
  });
});
