import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { execFile } from '../../node';
import { grepSearch } from '.';

vi.mock('node:fs');
vi.mock('../../node', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);
const RIPGREP_EXEC_OPTIONS = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024,
};

describe('grep', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecFile.mockRejectedValue(new Error('rg not found'));
  });

  describe('grepSearch', () => {
    it('finds matches using Node.js fallback', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('hello world\ntest line');

      const result = await grepSearch('hello', '/test');
      expect(result.content).toContain('hello world');
    });

    it('returns error when directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await grepSearch('test', '/missing');
      expect(result.error).toContain('Directory not found');
    });

    it('returns "No matches found" when pattern not found', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'file.txt', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('no matching content');

      const result = await grepSearch('xyz123', '/test');
      expect(result.content).toBe('No matches found');
    });

    it('returns error when search fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Search error');
      });

      const result = await grepSearch('test', '/test');
      expect(result.error).toContain('Search failed');
    });

    it('handles non-Error exceptions', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'search error';
      });

      const result = await grepSearch('test', '/test');
      expect(result.error).toContain('Search failed');
      expect(result.error).toContain('search error');
    });

    it('skips hidden directories and node_modules', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: unknown) => {
        const p = path as string;
        if (p === '/test') {
          return [
            { name: '.hidden', isDirectory: () => true, isFile: () => false },
            {
              name: 'node_modules',
              isDirectory: () => true,
              isFile: () => false,
            },
            { name: 'normal', isDirectory: () => true, isFile: () => false },
            { name: 'file.txt', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        if (p === join('/test', 'normal')) {
          return [
            {
              name: 'nested.txt',
              isDirectory: () => false,
              isFile: () => true,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('match content');

      const result = await grepSearch('match', '/test');
      expect(result.content).toContain('match content');
    });

    it('handles both directories and files in same listing', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: unknown) => {
        const p = path as string;
        if (p === '/test') {
          return [
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'file.txt', isDirectory: () => false, isFile: () => true },
            { name: 'symlink', isDirectory: () => false, isFile: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        if (p === join('/test', 'subdir')) {
          return [
            {
              name: 'nested.txt',
              isDirectory: () => false,
              isFile: () => true,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('search match here');

      const result = await grepSearch('match', '/test');
      expect(result.content).toContain('/test/file.txt');
      expect(result.content).toContain('/test/subdir/nested.txt');
      expect(result.content).not.toContain('symlink');
    });

    it('uses ripgrep when available and returns its output', async () => {
      mockExecFile.mockResolvedValue({
        stdout: '/test/file.ts:1: match line',
        stderr: '',
      });

      const result = await grepSearch('match', '/test');
      expect(result.content).toBe('/test/file.ts:1: match line');
      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        [
          '--line-number',
          '--no-heading',
          '--smart-case',
          '--',
          'match',
          '/test',
        ],
        RIPGREP_EXEC_OPTIONS,
      );
    });

    it('passes shell metacharacters to ripgrep as literal arguments', async () => {
      mockExecFile.mockResolvedValue({
        stdout: '/test/file.ts:1: literal payload',
        stderr: '',
      });

      const payload = '$(id>/tmp/poc-evidence)';

      const result = await grepSearch(payload, '/test');
      expect(result.content).toBe('/test/file.ts:1: literal payload');
      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        [
          '--line-number',
          '--no-heading',
          '--smart-case',
          '--',
          payload,
          '/test',
        ],
        RIPGREP_EXEC_OPTIONS,
      );
    });

    it('separates leading-dash patterns from ripgrep options', async () => {
      mockExecFile.mockResolvedValue({
        stdout: '/test/file.ts:1: -name',
        stderr: '',
      });

      const result = await grepSearch('-name', '/test');
      expect(result.content).toBe('/test/file.ts:1: -name');
      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        [
          '--line-number',
          '--no-heading',
          '--smart-case',
          '--',
          '-name',
          '/test',
        ],
        RIPGREP_EXEC_OPTIONS,
      );
    });

    it('falls through all ripgrep patterns when rg returns empty stdout', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'file.txt', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('hello world');

      const result = await grepSearch('hello', '/test');
      expect(result.content).toContain('hello world');
    });

    it('expands multi-word pattern into case variants for Node.js fallback', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'a.ts', isDirectory: () => false, isFile: () => true },
            { name: 'b.ts', isDirectory: () => false, isFile: () => true },
            { name: 'c.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockImplementation((path) => {
        const p = path as string;
        if (p.endsWith('a.ts')) return 'const myFunc = 1;';
        if (p.endsWith('b.ts')) return 'const MyFunc = 2;';
        if (p.endsWith('c.ts')) return 'const my_func = 3;';
        return '';
      });

      const result = await grepSearch('my func', '/test');
      expect(result.content).toContain('a.ts');
      expect(result.content).toContain('b.ts');
      expect(result.content).toContain('c.ts');
    });

    it('does not double-report a line matched by multiple pattern variants', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            { name: 'file.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockReturnValue('myFunc call here');

      const result = await grepSearch('my func', '/test');
      const lines = result.content.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
    });

    it('skips files that cannot be read', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path === '/test') {
          return [
            {
              name: 'readable.txt',
              isDirectory: () => false,
              isFile: () => true,
            },
            {
              name: 'unreadable.bin',
              isDirectory: () => false,
              isFile: () => true,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [];
      });
      vi.mocked(readFileSync).mockImplementation((path) => {
        if ((path as string).includes('unreadable')) {
          throw new Error('Cannot read');
        }
        return 'test content';
      });

      const result = await grepSearch('test', '/test');
      expect(result.content).toContain('test content');
    });
  });
});
