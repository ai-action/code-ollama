import { existsSync, readdirSync, statSync } from 'node:fs';

import { DEFAULT_FIND_FILES_IGNORED_DIRS, findFiles } from '.';

vi.mock('node:fs');

describe('find', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('findFiles', () => {
    it('returns all files recursively when pattern is omitted', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
            { name: 'src', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/src') {
          return [
            { name: 'file2.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test');

      expect(result.content).toBe('/test/file1.ts\n/test/src/file2.ts');
      expect(result.error).toBeUndefined();
    });

    it('filters files by case-insensitive substring pattern', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'Button.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'input.tsx', isDirectory: () => false, isFile: () => true },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = findFiles('/test', { pattern: 'button' });

      expect(result.content).toBe('/test/Button.tsx');
    });

    it('filters files by wildcard pattern', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'one.test.ts', isDirectory: () => false, isFile: () => true },
        { name: 'two.ts', isDirectory: () => false, isFile: () => true },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = findFiles('/test', { pattern: '*.test.ts' });

      expect(result.content).toBe('/test/one.test.ts');
    });

    it('filters files by single-character wildcard pattern', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'a.ts', isDirectory: () => false, isFile: () => true },
        { name: 'ab.ts', isDirectory: () => false, isFile: () => true },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = findFiles('/test', { pattern: '?.ts' });

      expect(result.content).toBe('/test/a.ts');
    });

    it('exports the default ignored directory list', () => {
      expect(DEFAULT_FIND_FILES_IGNORED_DIRS).toEqual([
        'node_modules',
        '__pycache__',
        '.*cache',
        '.tox',
        '.venv',
        'venv',
        'dist',
        'build',
        'coverage',
      ]);
    });

    it('skips hidden files, hidden directories, and default ignored directories', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: '.git', isDirectory: () => true, isFile: () => false },
            {
              name: 'node_modules',
              isDirectory: () => true,
              isFile: () => false,
            },
            {
              name: '__pycache__',
              isDirectory: () => true,
              isFile: () => false,
            },
            {
              name: '.env',
              isDirectory: () => false,
              isFile: () => true,
            },
            { name: 'src', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/src') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test');

      expect(result.content).toBe('/test/src/file.ts');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/.git',
        expect.anything(),
      );
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/node_modules',
        expect.anything(),
      );
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/__pycache__',
        expect.anything(),
      );
    });

    it('includes hidden files and directories when includeHidden is true', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: '.env', isDirectory: () => false, isFile: () => true },
            { name: '.config', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/.config') {
          return [
            {
              name: 'settings.json',
              isDirectory: () => false,
              isFile: () => true,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test', { includeHidden: true });

      expect(result.content).toBe('/test/.env\n/test/.config/settings.json');
    });

    it('uses ignoredDirs as an override for default ignored directory patterns', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            {
              name: '.pytest_cache',
              isDirectory: () => true,
              isFile: () => false,
            },
            { name: 'target', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/.pytest_cache') {
          return [
            { name: 'cache.db', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/target') {
          return [
            { name: 'debug', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test', {
        ignoredDirs: ['target'],
        includeHidden: true,
      });

      expect(result.content).toBe('/test/.pytest_cache/cache.db');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/target',
        expect.anything(),
      );
    });

    it('matches ignoredDirs wildcard patterns against directory names', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'target', isDirectory: () => true, isFile: () => false },
            {
              name: 'tmp-target',
              isDirectory: () => true,
              isFile: () => false,
            },
            { name: 'src', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/src') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test', { ignoredDirs: ['*target'] });

      expect(result.content).toBe('/test/src/file.ts');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/target',
        expect.anything(),
      );
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/tmp-target',
        expect.anything(),
      );
    });

    it('matches ignoredDirs single-character wildcard patterns', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'xcache', isDirectory: () => true, isFile: () => false },
            { name: 'src', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/src') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test', { ignoredDirs: ['?cache'] });

      expect(result.content).toBe('/test/src/file.ts');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/xcache',
        expect.anything(),
      );
    });

    it('always skips .git even when ignoredDirs is empty and includeHidden is true', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: '.git', isDirectory: () => true, isFile: () => false },
            { name: '.local', isDirectory: () => true, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        if (path === '/test/.local') {
          return [
            { name: 'file', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }

        return [];
      });

      const result = findFiles('/test', {
        ignoredDirs: [],
        includeHidden: true,
      });

      expect(result.content).toBe('/test/.local/file');
      expect(vi.mocked(readdirSync)).not.toHaveBeenCalledWith(
        '/test/.git',
        expect.anything(),
      );
    });

    it('returns error when directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findFiles('/missing');

      expect(result.error).toBe('Directory not found: /missing');
    });

    it('returns error when path is not a directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = findFiles('/file.txt');

      expect(result.error).toBe('Path is not a directory: /file.txt');
    });

    it('returns error when search fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = findFiles('/test');

      expect(result.error).toContain('Failed to find files');
      expect(result.error).toContain('Access denied');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'search failed';
      });

      const result = findFiles('/test');

      expect(result.error).toContain('Failed to find files');
      expect(result.error).toContain('search failed');
    });
  });
});
