import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { ToolName } from '@/types';

import {
  executeTool,
  executeToolCall,
  formatToolResultContent,
  normalizeToolCall,
  READ_TOOLS,
} from './index';

vi.mock('node:fs');
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

const { exec } = await import('node:child_process');
const mockExec = vi.mocked(exec);

vi.mock('@/config', () => ({
  loadConfig: vi.fn(() => ({
    host: 'http://localhost:11434',
    model: 'gemma4',
    searxngBaseUrl: undefined,
    theme: 'github-dark',
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

    it('normalizes known tool calls with approval metadata', () => {
      const normalized = normalizeToolCall({
        function: {
          name: 'write_file',
          arguments: { path: '/test.txt', content: 'hello' },
        },
      });

      expect(normalized.name).toBe('write_file');
      expect(normalized.requiresApproval).toBe(true);
    });

    it('rejects malformed tool calls before execution', async () => {
      const result = await executeToolCall({
        function: {
          name: 'writeFile',
          arguments: { path: '/test.txt', content: 'hello' },
        },
      });

      expect(result.error).toBe('Unknown tool: writeFile');
      expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled();
    });

    it('rejects invalid tool call argument payloads', async () => {
      const result = await executeToolCall({
        function: {
          name: 'read_file',
          arguments: null as unknown as Record<string, unknown>,
        },
      });

      expect(result.error).toBe('Invalid arguments for tool: read_file');
    });

    it('rejects invalid tool call arguments from validators', async () => {
      const result = await executeToolCall({
        function: {
          name: 'read_file',
          arguments: {},
        },
      });

      expect(result.error).toContain('Missing required argument: path');
    });

    it('formats failed tool results as not performed', () => {
      expect(
        formatToolResultContent('write_file', {
          content: '',
          error: 'Tool call rejected by user',
        }),
      ).toContain('The requested action was NOT performed');
    });

    it('formats successful tool results with content', () => {
      expect(
        formatToolResultContent('read_file', {
          content: 'file contents here',
          error: undefined,
        }),
      ).toContain('file contents here');
    });

    it('formats successful tool results with no content', () => {
      expect(
        formatToolResultContent('write_file', {
          content: '',
          error: undefined,
        }),
      ).toBe('Tool write_file result:');
    });

    it('formats tool arguments with short strings (no truncation)', () => {
      const result = formatToolResultContent(
        'read_file',
        { content: 'success' },
        { path: '/test.txt', maxLines: 100 },
      );
      expect(result).toContain('"path":"/test.txt"');
      expect(result).toContain('"maxLines":100');
    });

    it('formats tool arguments with long strings (truncated)', () => {
      const longContent = 'a'.repeat(100);
      const result = formatToolResultContent(
        'write_file',
        { content: 'success' },
        { path: '/test.txt', content: longContent },
      );
      expect(result).toContain('"path":"/test.txt"');
      expect(result).toContain('"content":"<100 chars>"');
    });

    it('formats tool arguments with multiline strings (truncated)', () => {
      const multilineContent = 'line1\nline2\nline3';
      const result = formatToolResultContent(
        'write_file',
        { content: 'success' },
        { path: '/test.txt', content: multilineContent },
      );
      expect(result).toContain('"content":"<17 chars>"');
    });

    it('returns error with received keys when required arg is missing', async () => {
      const result = await executeTool('list_dir', { dir: '/test' });
      expect(result.error).toContain('Missing required argument: path');
      expect(result.error).toContain('dir');
    });

    it('returns error with "none" when no args are provided', async () => {
      const result = await executeTool('list_dir', {});
      expect(result.error).toContain('Missing required argument: path');
      expect(result.error).toContain('none');
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

    it('returns error for invalid view_range numeric arguments', async () => {
      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: '2',
        end: 4,
      });

      expect(result.error).toContain('Missing required numeric arguments');
    });

    it('returns error when view_range end is less than start', async () => {
      const result = await executeTool('view_range', {
        path: '/test.txt',
        start: 5,
        end: 2,
      });

      expect(result.error).toContain('Invalid line range');
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

    it('executes web_fetch tool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('# Fetched Page\n\nContent here.'),
      } as unknown as Response);

      const result = await executeTool('web_fetch', {
        url: 'https://example.com',
      });
      expect(result.content).toContain('Fetched Page');
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid web_fetch URLs', async () => {
      const result = await executeTool('web_fetch', {
        url: 'file:///etc/passwd',
      });

      expect(result.error).toBe('URL must use http or https');
    });

    it('rejects unparsable web_fetch URLs', async () => {
      const result = await executeTool('web_fetch', {
        url: 'not a url',
      });

      expect(result.error).toBe('Invalid URL');
    });
  });
});
