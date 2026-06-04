import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';

import type { ToolName } from '@/types';

import {
  executeTool,
  executeToolCall,
  formatToolResultContent,
  normalizeToolCall,
  READ_TOOLS,
  WRITE_TOOLS,
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

    it('normalizes rename_path as a tool that requires approval', () => {
      const normalized = normalizeToolCall({
        function: {
          name: 'rename_path',
          arguments: { from: '/from', to: '/to' },
        },
      });

      expect(normalized.name).toBe('rename_path');
      expect(normalized.requiresApproval).toBe(true);
      expect(WRITE_TOOLS.has('rename_path')).toBe(true);
    });

    it('normalizes create_directory as a tool that requires approval', () => {
      const normalized = normalizeToolCall({
        function: {
          name: 'create_directory',
          arguments: { path: '/test' },
        },
      });

      expect(normalized.name).toBe('create_directory');
      expect(normalized.requiresApproval).toBe(true);
      expect(WRITE_TOOLS.has('create_directory')).toBe(true);
    });

    it('normalizes delete_path as a tool that requires approval', () => {
      const normalized = normalizeToolCall({
        function: {
          name: 'delete_path',
          arguments: { path: '/test.txt', recursive: false },
        },
      });

      expect(normalized.name).toBe('delete_path');
      expect(normalized.requiresApproval).toBe(true);
      expect(WRITE_TOOLS.has('delete_path')).toBe(true);
    });

    it('normalizes find_files as a tool that does not require approval', () => {
      const normalized = normalizeToolCall({
        function: {
          name: 'find_files',
          arguments: { path: '/test', pattern: '*.ts' },
        },
      });

      expect(normalized.name).toBe('find_files');
      expect(normalized.requiresApproval).toBe(false);
      expect(READ_TOOLS.has('find_files')).toBe(true);
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

    it('returns error when rename_path required args are missing', async () => {
      const result = await executeTool('rename_path', { from: '/from' });
      expect(result.error).toContain('Missing required argument: to');
      expect(result.error).toContain('from');
    });

    it('returns error when create_directory required args are missing', async () => {
      const result = await executeTool('create_directory', {});
      expect(result.error).toContain('Missing required argument: path');
      expect(result.error).toContain('none');
    });

    it('returns error when delete_path recursive arg is missing', async () => {
      const result = await executeTool('delete_path', { path: '/test.txt' });
      expect(result.error).toContain(
        'Missing required boolean argument: recursive',
      );
      expect(result.error).toContain('path');
    });

    it('returns error when delete_path recursive arg is not boolean', async () => {
      const result = await executeTool('delete_path', {
        path: '/test.txt',
        recursive: 'false',
      });
      expect(result.error).toContain(
        'Missing required boolean argument: recursive',
      );
    });

    it('returns error when find_files pattern arg is not a string', async () => {
      const result = await executeTool('find_files', {
        path: '/test',
        pattern: 123,
      });
      expect(result.error).toContain(
        'Invalid optional argument: pattern must be a string',
      );
    });

    it('returns error when find_files includeHidden arg is not a boolean', async () => {
      const result = await executeTool('find_files', {
        path: '/test',
        includeHidden: 'true',
      });
      expect(result.error).toContain(
        'Invalid optional argument: includeHidden must be a boolean',
      );
    });

    it('returns error when find_files ignoredDirs arg is not an array of strings', async () => {
      const result = await executeTool('find_files', {
        path: '/test',
        ignoredDirs: ['target', 123],
      });
      expect(result.error).toContain(
        'Invalid optional argument: ignoredDirs must be an array of strings',
      );
    });

    it('returns error when read_file range args are not numbers', async () => {
      const result = await executeTool('read_file', {
        path: '/test.txt',
        startLine: '2',
      });

      expect(result.error).toContain(
        'Invalid optional numeric argument: startLine',
      );
    });

    it('returns error when read_file range args are below one', async () => {
      const result = await executeTool('read_file', {
        path: '/test.txt',
        maxLines: 0,
      });

      expect(result.error).toContain(
        'Invalid read range: startLine, endLine, and maxLines must be >= 1',
      );
    });

    it('returns error when read_file combines endLine and maxLines', async () => {
      const result = await executeTool('read_file', {
        path: '/test.txt',
        endLine: 3,
        maxLines: 2,
      });

      expect(result.error).toContain(
        'Invalid read range: endLine cannot be combined with maxLines',
      );
    });

    it('returns error when read_file endLine is less than startLine', async () => {
      const result = await executeTool('read_file', {
        path: '/test.txt',
        endLine: 2,
        startLine: 5,
      });

      expect(result.error).toContain(
        'Invalid read range: endLine must be >= startLine',
      );
    });

    it('executes read_file tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('file content');

      const result = await executeTool('read_file', { path: '/test.txt' });
      expect(result.content).toBe('file content');
      expect(result.error).toBeUndefined();
    });

    it('executes read_file tool with line range', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = await executeTool('read_file', {
        path: '/test.txt',
        endLine: 3,
        startLine: 2,
      });

      expect(result.content).toBe('2: line2\n3: line3');
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

    it('executes rename_path tool', async () => {
      vi.mocked(existsSync).mockImplementation((path) => path === '/from');

      const result = await executeTool('rename_path', {
        from: '/from',
        to: '/to',
      });

      expect(result.content).toBe('Path renamed successfully: /from -> /to');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(renameSync)).toHaveBeenCalledWith('/from', '/to');
    });

    it('executes create_directory tool', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await executeTool('create_directory', {
        path: '/test/nested',
      });

      expect(result.content).toBe(
        'Directory created successfully: /test/nested',
      );
      expect(result.error).toBeUndefined();
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('/test/nested', {
        recursive: true,
      });
    });

    it('executes delete_path tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = await executeTool('delete_path', {
        path: '/test.txt',
        recursive: false,
      });

      expect(result.content).toBe('Path deleted successfully: /test.txt');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(rmSync)).toHaveBeenCalledWith('/test.txt', {
        force: false,
      });
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

    it('blocks rename_path when only read tools are allowed', async () => {
      const result = await executeTool(
        'rename_path',
        {
          from: '/from',
          to: '/to',
        },
        { allowedTools: READ_TOOLS },
      );

      expect(result.error).toBe('Tool not allowed: rename_path');
      expect(vi.mocked(renameSync)).not.toHaveBeenCalled();
    });

    it('blocks create_directory when only read tools are allowed', async () => {
      const result = await executeTool(
        'create_directory',
        {
          path: '/test',
        },
        { allowedTools: READ_TOOLS },
      );

      expect(result.error).toBe('Tool not allowed: create_directory');
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });

    it('blocks delete_path when only read tools are allowed', async () => {
      const result = await executeTool(
        'delete_path',
        {
          path: '/test.txt',
          recursive: false,
        },
        { allowedTools: READ_TOOLS },
      );

      expect(result.error).toBe('Tool not allowed: delete_path');
      expect(vi.mocked(rmSync)).not.toHaveBeenCalled();
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

    it('executes find_files tool', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true },
      ] as unknown[] as ReturnType<typeof readdirSync>);

      const result = await executeTool('find_files', {
        ignoredDirs: [],
        includeHidden: true,
        path: '/test',
        pattern: '*.ts',
      });

      expect(result.content).toBe('/test/file.ts');
      expect(result.error).toBeUndefined();
    });

    it('allows find_files when only read tools are allowed', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true },
      ] as unknown[] as ReturnType<typeof readdirSync>);

      const result = await executeTool(
        'find_files',
        {
          path: '/test',
        },
        { allowedTools: READ_TOOLS },
      );

      expect(result.content).toBe('/test/file.ts');
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
