import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ToolName } from '../types';
import { executeTool, READ_TOOLS, TOOLS, WRITE_TOOLS } from './tools';

vi.mock('node:fs');
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));
vi.mock('./config', () => ({
  loadConfig: vi.fn(() => ({
    host: 'http://localhost:11434',
    model: 'gemma4',
    searxngBaseUrl: undefined,
  })),
}));

const { exec } = await import('node:child_process');
const mockExec = vi.mocked(exec);
const { loadConfig } = await import('./config');
const mockLoadConfig = vi.mocked(loadConfig);
const mockFetch = vi.fn<typeof fetch>();

describe('tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockLoadConfig.mockReturnValue({
      host: 'http://localhost:11434',
      model: 'gemma4',
      searxngBaseUrl: undefined,
    });
  });

  describe('TOOLS', () => {
    it('exports tool definitions', () => {
      expect(TOOLS).toHaveLength(8);
      expect(TOOLS.map((t) => t.function.name)).toContain('read_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('write_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('edit_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('run_shell');
      expect(TOOLS.map((t) => t.function.name)).toContain('list_dir');
      expect(TOOLS.map((t) => t.function.name)).toContain('grep_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('view_range');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_search');
    });
  });

  describe('WRITE_TOOLS', () => {
    it('contains write_file, edit_file, and run_shell', () => {
      expect(WRITE_TOOLS.has('write_file')).toBe(true);
      expect(WRITE_TOOLS.has('edit_file')).toBe(true);
      expect(WRITE_TOOLS.has('run_shell')).toBe(true);
      expect(WRITE_TOOLS.has('read_file')).toBe(false);
    });
  });

  describe('READ_TOOLS', () => {
    it('contains web_search', () => {
      expect(READ_TOOLS.has('web_search')).toBe(true);
      expect(READ_TOOLS.has('write_file')).toBe(false);
    });
  });

  describe('executeTool', () => {
    it('returns error for unknown tool', async () => {
      const result = await executeTool('unknown_tool' as ToolName, {});
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
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith(
        '/test.txt',
        'before updated after',
        'utf8',
      );
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

    it('executes web_search with SearXNG results', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          JSON.stringify({
            results: [
              {
                title: 'Example Result',
                url: 'https://example.com',
                content: 'Useful snippet',
              },
            ],
          }),
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Source: SearXNG');
      expect(result.content).toContain('Example Result');
      expect(result.content).toContain('https://example.com');
    });

    it('treats a missing SearXNG results array as empty and falls back', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch
        .mockResolvedValueOnce(createFetchResponse(JSON.stringify({}), 200))
        .mockResolvedValueOnce(
          createFetchResponse(
            `
              <a class="result__a" href="https://example.com">Example Result</a>
              <div class="result__snippet">Fallback snippet</div>
            `,
            200,
          ),
        );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).toContain('SearXNG returned no results');
    });

    it('normalizes sparse SearXNG results and omits empty snippets', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          JSON.stringify({
            results: [
              {
                url: 'https://missing-title.example.com',
                content: 'Should be filtered out',
              },
              {
                title: 'Missing URL',
              },
              {
                title: 'Valid Result',
                url: 'https://example.com',
              },
            ],
          }),
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Valid Result');
      expect(result.content).not.toContain('Should be filtered out');
      expect(result.content).not.toContain('Snippet:');
    });

    it('falls back to DuckDuckGo when SearXNG fails', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(
          createFetchResponse(
            `
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example Result</a>
              <div class="result__snippet">Fallback snippet</div>
            `,
            200,
          ),
        );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).toContain('Using DuckDuckGo fallback');
      expect(result.content).toContain('https://example.com');
    });

    it('uses DuckDuckGo directly when no SearXNG URL is configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://example.com">Example Result</a>
            <div class="result__snippet">Snippet</div>
          `,
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).not.toContain('Using DuckDuckGo fallback');
    });

    it('returns no results when both providers are empty', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse(JSON.stringify({ results: [] }), 200),
        )
        .mockResolvedValueOnce(createFetchResponse('<html></html>', 200));

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('No web results found');
      expect(result.error).toBeUndefined();
    });

    it('returns an error when both providers fail', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch
        .mockRejectedValueOnce(new Error('SearXNG timeout'))
        .mockRejectedValueOnce(new Error('DuckDuckGo timeout'));

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.error).toContain('SearXNG failed: SearXNG timeout');
      expect(result.error).toContain('DuckDuckGo failed: DuckDuckGo timeout');
    });

    it('handles non-Error SearXNG failures', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
      });
      mockFetch.mockRejectedValueOnce('searxng exploded').mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://example.com">Example Result</a>
            <div class="result__snippet">Fallback snippet</div>
          `,
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('SearXNG failed: searxng exploded');
    });

    it('rejects empty search queries', async () => {
      const result = await executeTool('web_search', { query: '   ' });
      expect(result.error).toBe('Search query cannot be empty');
    });

    it('returns an HTTP error when DuckDuckGo responds with a non-OK status', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse('bad gateway', 502));

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.error).toContain('DuckDuckGo failed: HTTP 502');
    });

    it('handles non-Error DuckDuckGo failures', async () => {
      mockFetch.mockRejectedValueOnce('duckduckgo exploded');

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.error).toContain('DuckDuckGo failed: duckduckgo exploded');
    });

    it('skips invalid DuckDuckGo results and caps output at five entries', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://skip.test"></a>
            <div class="result__snippet">Skip me</div>
            <a class="result__a" href="https://example1.com">Result 1</a>
            <div class="result__snippet">Snippet 1</div>
            <a class="result__a" href="https://example2.com">Result 2</a>
            <div class="result__snippet">Snippet 2</div>
            <a class="result__a" href="https://example3.com">Result 3</a>
            <div class="result__snippet">Snippet 3</div>
            <a class="result__a" href="https://example4.com">Result 4</a>
            <div class="result__snippet">Snippet 4</div>
            <a class="result__a" href="https://example5.com">Result 5</a>
            <div class="result__snippet">Snippet 5</div>
            <a class="result__a" href="https://example6.com">Result 6</a>
            <div class="result__snippet">Snippet 6</div>
          `,
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Result 1');
      expect(result.content).toContain('Result 5');
      expect(result.content).not.toContain('Result 6');
      expect(result.content).not.toContain('Skip me');
    });

    it('truncates long snippets in formatted search output', async () => {
      const longSnippet = 'a'.repeat(300);
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://example.com">Example Result</a>
            <div class="result__snippet">${longSnippet}</div>
          `,
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('Snippet:');
      expect(result.content).toContain('…');
      expect(result.content).not.toContain(longSnippet);
    });

    it('preserves malformed DuckDuckGo URLs when URL normalization fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="http://%">Odd Result</a>
            <div class="result__snippet">Odd snippet</div>
          `,
          200,
        ),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toContain('http://%');
    });

    it('returns no results when DuckDuckGo has no matches and SearXNG is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse('<html></html>', 200),
      );

      const result = await executeTool('web_search', { query: 'example' });
      expect(result.content).toBe('No web results found.');
      expect(result.error).toBeUndefined();
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

  describe('editFile error handling', () => {
    it('returns error when file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('edit_file', {
        path: '/missing.txt',
        oldText: 'before',
        newText: 'after',
      });
      expect(result.error).toContain('File not found');
    });

    it('returns error when text is not found', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('content');

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'missing',
        newText: 'after',
      });
      expect(result.error).toContain('Exact text not found');
    });

    it('returns error when text matches multiple locations', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('repeat repeat');

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'repeat',
        newText: 'after',
      });
      expect(result.error).toContain('matched multiple locations');
    });

    it('returns error when read fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'before',
        newText: 'after',
      });
      expect(result.error).toContain('Failed to edit file');
    });

    it('returns error when write fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('before');
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'before',
        newText: 'after',
      });
      expect(result.error).toContain('Failed to edit file');
    });

    it('handles non-Error exceptions in editFile', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'edit failed';
      });

      const result = await executeTool('edit_file', {
        path: '/test.txt',
        oldText: 'before',
        newText: 'after',
      });
      expect(result.error).toContain('Failed to edit file');
      expect(result.error).toContain('edit failed');
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

function createFetchResponse(body: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
