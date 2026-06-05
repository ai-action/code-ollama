import { exec, execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';

import { findFiles } from './find';

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('node:fs');

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

function createDirent(
  name: string,
  type: 'directory' | 'file' | 'other',
): Dirent {
  return {
    name,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => type === 'directory',
    isFIFO: () => false,
    isFile: () => type === 'file',
    isSocket: () => false,
    isSymbolicLink: () => false,
  } as Dirent;
}

function mockDirectoryExists() {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(statSync).mockReturnValue({
    isDirectory: () => true,
  } as ReturnType<typeof statSync>);
}

function mockRipgrepSuccess(stdout: string) {
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const callback = args[3] as (
      error: Error | null,
      stdout: string,
      stderr: string,
    ) => void;
    callback(null, stdout, '');
    return {} as ReturnType<typeof execFile>;
  });
}

function mockRipgrepFailure() {
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const callback = args[3] as (
      error: Error | null,
      stdout: string,
      stderr: string,
    ) => void;
    callback(new Error('rg missing'), '', '');
    return {} as ReturnType<typeof execFile>;
  });
}

function mockRipgrepNonErrorFailure() {
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const callback = args[3] as (
      error: Error | null,
      stdout: string,
      stderr: string,
    ) => void;
    callback('rg missing' as unknown as Error, '', '');
    return {} as ReturnType<typeof execFile>;
  });
}

describe('find', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(exec).mockImplementation((...args: unknown[]) => {
      const callback = args[2] as (err: Error | null) => void;
      callback(new Error('rg not found'));
      return {} as ReturnType<typeof exec>;
    });
  });

  describe('findFiles', () => {
    it('returns ripgrep files rooted at the requested directory', async () => {
      mockDirectoryExists();
      mockRipgrepSuccess('file1.ts\nsrc/file2.ts\n');

      const result = await findFiles('/test');

      expect(result.content).toBe('/test/file1.ts\n/test/src/file2.ts');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(execFile)).toHaveBeenCalledWith(
        'rg',
        ['--files'],
        { cwd: '/test', maxBuffer: 10 * 1024 * 1024 },
        expect.any(Function),
      );
    });

    it('passes hidden flags to ripgrep when includeHidden is true', async () => {
      mockDirectoryExists();
      mockRipgrepSuccess('.env\n.config/settings.json\n');

      const result = await findFiles('/test', { includeHidden: true });

      expect(result.content).toBe('/test/.env\n/test/.config/settings.json');
      expect(vi.mocked(execFile)).toHaveBeenCalledWith(
        'rg',
        ['--files', '--hidden', '-g', '!**/.git/**'],
        { cwd: '/test', maxBuffer: 10 * 1024 * 1024 },
        expect.any(Function),
      );
    });

    it('filters files by case-insensitive substring pattern', async () => {
      mockDirectoryExists();
      mockRipgrepSuccess('Button.tsx\ninput.tsx\n');

      const result = await findFiles('/test', { pattern: 'button' });

      expect(result.content).toBe('/test/Button.tsx');
    });

    it('filters files by wildcard pattern', async () => {
      mockDirectoryExists();
      mockRipgrepSuccess('one.test.ts\ntwo.ts\n');

      const result = await findFiles('/test', { pattern: '*.test.ts' });

      expect(result.content).toBe('/test/one.test.ts');
    });

    it('filters files by single-character wildcard pattern', async () => {
      mockDirectoryExists();
      mockRipgrepSuccess('a.ts\nab.ts\n');

      const result = await findFiles('/test', { pattern: '?.ts' });

      expect(result.content).toBe('/test/a.ts');
    });

    it('falls back to Node.js traversal that respects .gitignore', async () => {
      mockDirectoryExists();
      mockRipgrepFailure();
      vi.mocked(readFile).mockResolvedValue('ignored.log\nbuild/\n');
      vi.mocked(readdir).mockImplementation((path) => {
        if (path === '/test') {
          return Promise.resolve([
            createDirent('.git', 'directory'),
            createDirent('.gitignore', 'file'),
            createDirent('build', 'directory'),
            createDirent('ignored.log', 'file'),
            createDirent('keep.ts', 'file'),
            createDirent('src', 'directory'),
          ] as unknown as ReturnType<typeof readdir>);
        }

        if (path === '/test/src') {
          return Promise.resolve([
            createDirent('file.ts', 'file'),
          ] as unknown as ReturnType<typeof readdir>);
        }

        if (path === '/test/build') {
          return Promise.resolve([
            createDirent('out.js', 'file'),
          ] as unknown as ReturnType<typeof readdir>);
        }

        return Promise.resolve([]);
      });

      const result = await findFiles('/test');

      expect(result.content).toBe('/test/keep.ts\n/test/src/file.ts');
      expect(vi.mocked(readdir)).not.toHaveBeenCalledWith(
        '/test/.git',
        expect.anything(),
      );
      expect(vi.mocked(readdir)).not.toHaveBeenCalledWith(
        '/test/build',
        expect.anything(),
      );
    });

    it('fallback works when no .gitignore file exists', async () => {
      vi.mocked(existsSync).mockImplementation((path) => path === '/test');
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      mockRipgrepFailure();
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(readdir).mockResolvedValue([
        createDirent('file.ts', 'file'),
      ] as never);

      const result = await findFiles('/test');

      expect(result.content).toBe('/test/file.ts');
    });

    it('falls back when ripgrep fails with a non-Error value', async () => {
      mockDirectoryExists();
      mockRipgrepNonErrorFailure();
      vi.mocked(readFile).mockResolvedValue('');
      vi.mocked(readdir).mockResolvedValue([
        createDirent('file.ts', 'file'),
      ] as never);

      const result = await findFiles('/test');

      expect(result.content).toBe('/test/file.ts');
    });

    it('fallback includes hidden files and directories when includeHidden is true', async () => {
      mockDirectoryExists();
      mockRipgrepFailure();
      vi.mocked(readFile).mockResolvedValue('');
      vi.mocked(readdir).mockImplementation((path) => {
        if (path === '/test') {
          return Promise.resolve([
            createDirent('.env', 'file'),
            createDirent('.config', 'directory'),
          ] as unknown as ReturnType<typeof readdir>);
        }

        if (path === '/test/.config') {
          return Promise.resolve([
            createDirent('settings.json', 'file'),
          ] as unknown as ReturnType<typeof readdir>);
        }

        return Promise.resolve([]);
      });

      const result = await findFiles('/test', { includeHidden: true });

      expect(result.content).toBe('/test/.env\n/test/.config/settings.json');
    });

    it('returns error when directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await findFiles('/missing');

      expect(result.error).toBe('Directory not found: /missing');
    });

    it('returns error when path is not a directory', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = await findFiles('/file.txt');

      expect(result.error).toBe('Path is not a directory: /file.txt');
    });

    it('returns error when fallback search fails', async () => {
      mockDirectoryExists();
      mockRipgrepFailure();
      vi.mocked(readFile).mockResolvedValue('');
      vi.mocked(readdir).mockRejectedValue(new Error('Access denied'));

      const result = await findFiles('/test');

      expect(result.error).toContain('Failed to find files');
      expect(result.error).toContain('Access denied');
    });

    it('handles non-Error fallback exceptions', async () => {
      mockDirectoryExists();
      mockRipgrepFailure();
      vi.mocked(readFile).mockResolvedValue('');
      vi.mocked(readdir).mockRejectedValue('search failed');

      const result = await findFiles('/test');

      expect(result.error).toContain('Failed to find files');
      expect(result.error).toContain('search failed');
    });
  });
});
