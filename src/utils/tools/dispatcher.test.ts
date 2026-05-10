import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { ToolName } from '../../types';
import { executeTool, READ_TOOLS } from './index';

vi.mock('node:fs');
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('node:child_process');
const mockExec = vi.mocked(exec);

vi.mock('../../config', () => ({
  loadConfig: vi.fn(() => ({
    host: 'http://localhost:11434',
    model: 'gemma4',
    searxngBaseUrl: undefined,
  })),
}));

const mockFetch = vi.fn<typeof fetch>();

describe('dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool(
        'unknown_tool' as unknown as ToolName,
        {},
      );
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

    it('executes edit_file tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('before target after');

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'target',
        newText: 'updated',
      });

      expect(result.content).toContain('File edited successfully');
    });

    it('blocks disallowed tools when allowedTools is provided', async () => {
      const result = await executeTool(
        'write_file',
        {
          path: '/test.txt',
          content: 'new content',
        },
        { allowedTools: READ_TOOLS },
      );

      expect(result.error).toBe('Tool not allowed: write_file');
      expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled();
    });

    it('executes run_shell tool', async () => {
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
      expect(result.error).toBeUndefined();
    });

    it('executes list_dir tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'dir1', isFile: () => false, isDirectory: () => true },
      ] as unknown[] as ReturnType<typeof readdirSync>);

      const result = await executeTool('list_dir', { path: '/test' });
      expect(result.content).toContain('file1.txt');
      expect(result.content).toContain('dir1');
      expect(result.error).toBeUndefined();
    });

    it('executes grep_search tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await executeTool('grep_search', {
        pattern: 'test',
        path: '/test',
      });
      expect(result.content).toBeDefined();
      expect(result.error).toBeUndefined();
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
      expect(result.content).toContain('line2');
      expect(result.content).toContain('line3');
      expect(result.content).toContain('line4');
      expect(result.error).toBeUndefined();
    });

    it('executes web_search tool', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi
          .fn()
          .mockResolvedValue(
            '<html><body>' +
              '<a class="result__a" href="/l/?uddg=http%3A%2F%2Fexample.com">Example Title</a>' +
              '<a class="result__snippet">Test snippet for the result</a>' +
              '</body></html>',
          ),
      } as unknown as Response);

      const result = await executeTool('web_search', { query: 'test query' });
      expect(result.content).toContain('Source');
      expect(result.error).toBeUndefined();
    });
  });
});
