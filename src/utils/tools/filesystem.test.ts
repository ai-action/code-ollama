import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  editFile,
  grepSearch,
  listDir,
  readFile,
  viewRange,
  writeFile,
} from './filesystem';

vi.mock('node:fs');
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('node:child_process');
const mockExec = vi.mocked(exec);

describe('filesystem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: ripgrep not available
    mockExec.mockImplementation((...args: unknown[]) => {
      const callback = args[2] as (err: Error | null) => void;
      callback(new Error('rg not found'));
      return {} as ReturnType<typeof exec>;
    });
  });

  describe('readFile', () => {
    it('reads file contents', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('file content');

      const result = readFile('/test.txt');
      expect(result.content).toBe('file content');
      expect(result.error).toBeUndefined();
    });

    it('returns error when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = readFile('/missing.txt');
      expect(result.error).toContain('File not found');
    });

    it('returns error when read fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = readFile('/test.txt');
      expect(result.error).toContain('Failed to read file');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      });

      const result = readFile('/test.txt');
      expect(result.error).toContain('Failed to read file');
      expect(result.error).toContain('string error');
    });
  });

  describe('writeFile', () => {
    it('writes file successfully', () => {
      const result = writeFile('/test.txt', 'new content');
      expect(result.content).toContain('File written successfully');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        '/test.txt',
        'new content',
        'utf8',
      );
    });

    it('returns error when write fails', () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = writeFile('/test.txt', 'data');
      expect(result.error).toContain('Failed to write file');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'disk full';
      });

      const result = writeFile('/test.txt', 'data');
      expect(result.error).toContain('Failed to write file');
      expect(result.error).toContain('disk full');
    });
  });

  describe('editFile', () => {
    it('edits file successfully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('before target after');

      const result = editFile('/test.txt', 'target', 'updated');
      expect(result.content).toContain('File edited successfully');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        '/test.txt',
        'before updated after',
        'utf8',
      );
    });

    it('returns error when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = editFile('/missing.txt', 'before', 'after');
      expect(result.error).toContain('File not found');
    });

    it('returns error when text is not found', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('content');

      const result = editFile('/test.txt', 'missing', 'after');
      expect(result.error).toContain('Exact text not found');
    });

    it('returns error when text matches multiple locations', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('repeat repeat');

      const result = editFile('/test.txt', 'repeat', 'after');
      expect(result.error).toContain('matched multiple locations');
    });

    it('returns error when read fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('Failed to edit file');
    });

    it('returns error when write fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('before');
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('Failed to edit file');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'edit failed';
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('Failed to edit file');
      expect(result.error).toContain('edit failed');
    });
  });

  describe('viewRange', () => {
    it('views specific line range', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        'line1\nline2\nline3\nline4\nline5',
      );

      const result = viewRange('/test.txt', 2, 4);
      expect(result.content).toBe('line2\nline3\nline4');
    });

    it('returns error when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = viewRange('/missing.txt', 1, 5);
      expect(result.error).toContain('File not found');
    });

    it('returns error for invalid line range', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('short file');

      const result = viewRange('/test.txt', 100, 200);
      expect(result.error).toContain('Invalid line range');
    });

    it('returns error when read fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('IO error');
      });

      const result = viewRange('/test.txt', 1, 5);
      expect(result.error).toContain('Failed to view range');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'io error';
      });

      const result = viewRange('/test.txt', 1, 5);
      expect(result.error).toContain('Failed to view range');
      expect(result.error).toContain('io error');
    });
  });

  describe('listDir', () => {
    it('lists directory contents', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'dir1', isDirectory: () => true, isFile: () => false },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = listDir('/test');
      expect(result.content).toContain('[f] file1.txt');
      expect(result.content).toContain('[d] dir1');
    });

    it('returns error when directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = listDir('/missing');
      expect(result.error).toContain('Directory not found');
    });

    it('returns error when listing fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = listDir('/test');
      expect(result.error).toContain('Failed to list directory');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'access denied';
      });

      const result = listDir('/test');
      expect(result.error).toContain('Failed to list directory');
      expect(result.error).toContain('access denied');
    });
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
      expect(result.content).toContain('file.txt');
      expect(result.content).toContain('nested.txt');
      expect(result.content).not.toContain('symlink');
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
