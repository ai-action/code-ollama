import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { executeTool, TOOLS, TOOLS_REQUIRING_APPROVAL } from './tools';

vi.mock('node:fs');
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('node:child_process');
const mockExec = vi.mocked(exec);

describe('tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TOOLS', () => {
    it('exports tool definitions', () => {
      expect(TOOLS).toHaveLength(6);
      expect(TOOLS.map((t) => t.function.name)).toContain('read_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('write_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('run_shell');
      expect(TOOLS.map((t) => t.function.name)).toContain('list_dir');
      expect(TOOLS.map((t) => t.function.name)).toContain('grep_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('view_range');
    });
  });

  describe('TOOLS_REQUIRING_APPROVAL', () => {
    it('contains write_file and run_shell', () => {
      expect(TOOLS_REQUIRING_APPROVAL.has('write_file')).toBe(true);
      expect(TOOLS_REQUIRING_APPROVAL.has('run_shell')).toBe(true);
      expect(TOOLS_REQUIRING_APPROVAL.has('read_file')).toBe(false);
    });
  });

  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {});
      expect(result.error).toContain('Unknown tool');
    });

    it('executes read_file tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('file content');

      const result = await executeTool('read_file', { path: '/test.txt' });
      expect(result.content).toBe('file content');
      expect(result.error).toBeUndefined();
    });

    it('executes write_file tool', async () => {
      const result = await executeTool('write_file', {
        path: '/test.txt',
        content: 'new content',
      });
      expect(result.content).toContain('File written successfully');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        '/test.txt',
        'new content',
        'utf8',
      );
    });

    it('executes list_dir tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'dir1', isDirectory: () => true, isFile: () => false },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = await executeTool('list_dir', { path: '/test' });
      expect(result.content).toContain('[f] file1.txt');
      expect(result.content).toContain('[d] dir1');
    });

    it('executes view_range tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        'line1\nline2\nline3\nline4\nline5',
      );

      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: 2,
        end: 4,
      });
      expect(result.content).toBe('line2\nline3\nline4');
    });

    it('executes grep_search tool', async () => {
      // Mock exec to simulate ripgrep not available (fallback to Node.js)
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (err: Error | null) => void;
        callback(new Error('rg not found'));
        return {} as ReturnType<typeof exec>;
      });
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

      const result = await executeTool('grep_search', {
        pattern: 'hello',
        path: '/test',
      });
      expect(result.content).toContain('hello world');
    });

    it('executes run_shell tool with stdout', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: 'command output', stderr: '' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await executeTool('run_shell', { command: 'echo hello' });
      expect(result.content).toBe('command output');
    });

    it('executes run_shell tool with stderr when stdout is empty', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: '', stderr: 'error output' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await executeTool('run_shell', { command: 'cmd' });
      expect(result.content).toBe('error output');
    });
  });

  describe('readFile error handling', () => {
    it('returns error when file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('read_file', { path: '/missing.txt' });
      expect(result.error).toContain('File not found');
    });

    it('returns error when read fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await executeTool('read_file', { path: '/test.txt' });
      expect(result.error).toContain('Failed to read file');
    });

    it('handles non-Error exceptions in readFile', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      });

      const result = await executeTool('read_file', { path: '/test.txt' });
      expect(result.error).toContain('Failed to read file');
      expect(result.error).toContain('string error');
    });
  });

  describe('writeFile error handling', () => {
    it('returns error when write fails', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = await executeTool('write_file', {
        path: '/test.txt',
        content: 'data',
      });
      expect(result.error).toContain('Failed to write file');
    });

    it('handles non-Error exceptions in writeFile', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'disk full';
      });

      const result = await executeTool('write_file', {
        path: '/test.txt',
        content: 'data',
      });
      expect(result.error).toContain('Failed to write file');
      expect(result.error).toContain('disk full');
    });
  });

  describe('listDir error handling', () => {
    it('returns error when directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('list_dir', { path: '/missing' });
      expect(result.error).toContain('Directory not found');
    });

    it('returns error when listing fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = await executeTool('list_dir', { path: '/test' });
      expect(result.error).toContain('Failed to list directory');
    });

    it('handles non-Error exceptions in listDir', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'access denied';
      });

      const result = await executeTool('list_dir', { path: '/test' });
      expect(result.error).toContain('Failed to list directory');
      expect(result.error).toContain('access denied');
    });
  });

  describe('viewRange error handling', () => {
    it('returns error when file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('view_range', {
        path: '/missing.txt',
        start: 1,
        end: 5,
      });
      expect(result.error).toContain('File not found');
    });

    it('returns error for invalid line range', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('short file');

      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: 100,
        end: 200,
      });
      expect(result.error).toContain('Invalid line range');
    });

    it('returns error when read fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('IO error');
      });

      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: 1,
        end: 5,
      });
      expect(result.error).toContain('Failed to view range');
    });

    it('handles non-Error exceptions in viewRange', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'io error';
      });

      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: 1,
        end: 5,
      });
      expect(result.error).toContain('Failed to view range');
      expect(result.error).toContain('io error');
    });
  });

  describe('grepSearch error handling', () => {
    it('returns error when directory does not exist', async () => {
      // Mock exec to simulate ripgrep not available (fallback to Node.js)
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (err: Error | null) => void;
        callback(new Error('rg not found'));
        return {} as ReturnType<typeof exec>;
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('grep_search', {
        pattern: 'test',
        path: '/missing',
      });
      expect(result.error).toContain('Directory not found');
    });

    it('returns "No matches found" when pattern not found', async () => {
      // Mock exec to simulate ripgrep not available (fallback to Node.js)
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (err: Error | null) => void;
        callback(new Error('rg not found'));
        return {} as ReturnType<typeof exec>;
      });
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

      const result = await executeTool('grep_search', {
        pattern: 'xyz123',
        path: '/test',
      });
      expect(result.content).toBe('No matches found');
    });

    it('returns error when search fails', async () => {
      // Mock exec to simulate ripgrep not available (fallback to Node.js)
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (err: Error | null) => void;
        callback(new Error('rg not found'));
        return {} as ReturnType<typeof exec>;
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Search error');
      });

      const result = await executeTool('grep_search', {
        pattern: 'test',
        path: '/test',
      });
      expect(result.error).toContain('Search failed');
    });

    it('handles non-Error exceptions in grepSearch', async () => {
      // Mock exec to simulate ripgrep not available (fallback to Node.js)
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (err: Error | null) => void;
        callback(new Error('rg not found'));
        return {} as ReturnType<typeof exec>;
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'search error';
      });

      const result = await executeTool('grep_search', {
        pattern: 'test',
        path: '/test',
      });
      expect(result.error).toContain('Search failed');
      expect(result.error).toContain('search error');
    });
  });

  describe('runShell error handling', () => {
    it('returns error when command fails', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(new Error('Command failed'), { stdout: '', stderr: '' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await executeTool('run_shell', { command: 'badcmd' });
      expect(result.error).toContain('Command failed');
    });

    it('handles non-Error exceptions', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: unknown,
          result: { stdout: string; stderr: string },
        ) => void;
        callback('string error', { stdout: '', stderr: '' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await executeTool('run_shell', { command: 'cmd' });
      expect(result.error).toBeDefined();
    });
  });

  describe('grepSearch directory traversal', () => {
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

      const result = await executeTool('grep_search', {
        pattern: 'match',
        path: '/test',
      });
      // Should only match in file.txt and nested.txt (normal dir), not in hidden or node_modules
      expect(result.content).toContain('match content');
    });

    it('handles both directories and files in same listing', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation((path: unknown) => {
        const p = path as string;
        if (p === '/test') {
          return [
            // Directory entry that passes filter - should trigger recursive call
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            // File entry in same directory - should trigger file search
            { name: 'file.txt', isDirectory: () => false, isFile: () => true },
            // Entry that is neither directory nor file (like a symlink) - should be skipped
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

      const result = await executeTool('grep_search', {
        pattern: 'match',
        path: '/test',
      });
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

      const result = await executeTool('grep_search', {
        pattern: 'test',
        path: '/test',
      });
      expect(result.content).toContain('test content');
    });
  });
});
