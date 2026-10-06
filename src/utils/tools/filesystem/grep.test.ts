import type { Stats } from 'node:fs';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { execFile } from '../../node';
import { grepSearch } from '.';
import { listDiscoveredFiles } from './discovery';

vi.mock('node:fs');
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));
vi.mock('./discovery');
vi.mock('../../node', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);
const mockListDiscoveredFiles = vi.mocked(listDiscoveredFiles);
const RIPGREP_EXEC_OPTIONS = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024,
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Mirrors the shape of a `promisify(execFile)` rejection. */
function execError(code: number | string): Error {
  return Object.assign(new Error('Command failed'), { code });
}

type StatResult = Awaited<ReturnType<typeof stat>>;

/**
 * Narrows the accepted `path` argument types to a comparable string. Only the
 * forms this tool actually passes are handled; anything else is stringified.
 */
function pathOf(target: Parameters<typeof readFile>[0]): string {
  if (typeof target === 'string') {
    return target;
  }

  if (typeof target === 'number') {
    return String(target);
  }

  if (target instanceof URL) {
    return target.pathname;
  }

  return Buffer.isBuffer(target) ? target.toString() : 'filehandle';
}

function fileStats(overrides?: {
  isFile?: boolean;
  size?: number;
}): StatResult {
  return {
    isFile: (): boolean => overrides?.isFile ?? true,
    size: overrides?.size ?? 1_024,
  } as Stats;
}

/**
 * Point discovery at a fixed set of files. Keys are paths relative to the
 * search root; contents are keyed by the absolute path the tool reads.
 */
function discoverFiles(files: Record<string, string>): void {
  mockListDiscoveredFiles.mockResolvedValue(Object.keys(files));

  const contents = new Map(
    Object.entries(files).map(([relativePath, content]) => [
      join('/test', relativePath),
      content,
    ]),
  );

  vi.mocked(stat).mockResolvedValue(fileStats());
  vi.mocked(readFile).mockImplementation((target) =>
    Promise.resolve(contents.get(pathOf(target)) ?? ''),
  );
}

describe('grep', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecFile.mockRejectedValue(new Error('rg not found'));
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(stat).mockResolvedValue(fileStats());
    mockListDiscoveredFiles.mockResolvedValue([]);
  });

  describe('grepSearch', () => {
    it('finds matches using Node.js fallback', async () => {
      discoverFiles({ 'file1.txt': 'hello world\ntest line' });

      const result = await grepSearch('hello', '/test');
      expect(result.content).toContain('hello world');
    });

    it('returns error when directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await grepSearch('test', '/missing');
      expect(result.error).toContain('Directory not found');
    });

    it('returns "No matches found" when pattern not found', async () => {
      discoverFiles({ 'file.txt': 'no matching content' });

      const result = await grepSearch('xyz123', '/test');
      expect(result.content).toBe('No matches found');
    });

    it('returns error when search fails', async () => {
      mockListDiscoveredFiles.mockRejectedValue(new Error('Search error'));

      const result = await grepSearch('test', '/test');
      expect(result.error).toContain('Search failed');
      expect(result.error).toContain('Search error');
    });

    it('handles non-Error exceptions', async () => {
      mockListDiscoveredFiles.mockRejectedValue('search error');

      const result = await grepSearch('test', '/test');
      expect(result.error).toContain('Search failed');
      expect(result.error).toContain('search error');
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

    it('returns no matches without rescanning the tree when rg finds nothing', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
      discoverFiles({ 'file.txt': 'hello world' });

      const result = await grepSearch('hello', '/test');

      expect(result.content).toBe('No matches found');
      expect(mockListDiscoveredFiles).not.toHaveBeenCalled();
    });

    it('returns no matches when rg exits 1 for every pattern variant', async () => {
      mockExecFile.mockRejectedValue(execError(1));
      discoverFiles({ 'file.txt': 'hello world' });

      const result = await grepSearch('hello', '/test');

      expect(result.content).toBe('No matches found');
      expect(mockListDiscoveredFiles).not.toHaveBeenCalled();
    });

    it('tries every case variant when rg exits 1', async () => {
      mockExecFile.mockRejectedValue(execError(1));

      await grepSearch('my func', '/test');

      expect(mockExecFile).toHaveBeenCalledTimes(6);
    });

    it('falls back to Node.js search when rg cannot parse the pattern', async () => {
      mockExecFile.mockRejectedValue(execError(2));
      discoverFiles({ 'file.txt': 'hello world' });

      const result = await grepSearch('hello', '/test');

      expect(result.content).toContain('hello world');
    });

    it('expands multi-word pattern into case variants for Node.js fallback', async () => {
      discoverFiles({
        'a.ts': 'const myFunc = 1;',
        'b.ts': 'const MyFunc = 2;',
        'c.ts': 'const my_func = 3;',
      });

      const result = await grepSearch('my func', '/test');
      expect(result.content).toContain('a.ts');
      expect(result.content).toContain('b.ts');
      expect(result.content).toContain('c.ts');
    });

    it('does not double-report a line matched by multiple pattern variants', async () => {
      discoverFiles({ 'file.ts': 'myFunc call here' });

      const result = await grepSearch('my func', '/test');
      const lines = result.content.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
    });

    it('skips files that cannot be read', async () => {
      mockListDiscoveredFiles.mockResolvedValue([
        'readable.txt',
        'unreadable.bin',
      ]);
      vi.mocked(readFile).mockImplementation((target) =>
        pathOf(target).includes('unreadable')
          ? Promise.reject(new Error('Cannot read'))
          : Promise.resolve('test content'),
      );

      const result = await grepSearch('test', '/test');
      expect(result.content).toContain('test content');
    });

    it('skips files larger than the size cap', async () => {
      mockListDiscoveredFiles.mockResolvedValue(['big.txt']);
      vi.mocked(stat).mockResolvedValue(
        fileStats({ size: MAX_FILE_BYTES + 1 }),
      );
      vi.mocked(readFile).mockResolvedValue('test content');

      const result = await grepSearch('test', '/test');

      expect(result.content).toBe('No matches found');
      expect(readFile).not.toHaveBeenCalled();
    });

    it('skips entries that are not regular files', async () => {
      mockListDiscoveredFiles.mockResolvedValue(['link']);
      vi.mocked(stat).mockResolvedValue(fileStats({ isFile: false }));

      const result = await grepSearch('test', '/test');
      expect(result.content).toBe('No matches found');
    });

    it('skips binary files', async () => {
      mockListDiscoveredFiles.mockResolvedValue(['image.bin']);
      vi.mocked(readFile).mockResolvedValue('abc def');

      const result = await grepSearch('test', '/test');
      expect(result.content).toBe('No matches found');
    });

    it('skips lines longer than the line cap', async () => {
      const longLine = `needle${'x'.repeat(2_100)}`;
      discoverFiles({ 'minified.js': `${longLine}\nneedle` });

      const result = await grepSearch('needle', '/test');
      const lines = result.content.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(':2: needle');
    });

    it('truncates results at the result cap', async () => {
      const files = Object.fromEntries(
        Array.from({ length: 600 }, (_, index) => [
          `file${String(index)}.txt`,
          'needle line',
        ]),
      );
      discoverFiles(files);

      const result = await grepSearch('needle', '/test');
      const lines = result.content.split('\n').filter(Boolean);

      expect(lines).toHaveLength(501);
      expect(lines.at(-1)).toContain('search truncated');
    });

    describe('unsafe patterns', () => {
      const cases = [
        ['nested quantifier', '(a+)+$'],
        ['repeated alternation', '(a|a)*c'],
        ['nested quantifier over a wildcard', '(\\w+\\s?)*$'],
        ['brace repetition of a group', '(a+){2,}'],
      ] as const;

      for (const [label, pattern] of cases) {
        it(`degrades a ${label} to a literal search`, async () => {
          const line = `${pattern} and needle`;
          discoverFiles({ 'file.txt': line });

          const result = await grepSearch(pattern, '/test');

          expect(result.content).toContain('needle');
        });
      }

      it('completes quickly against a catastrophic input', async () => {
        const payload = `${'a'.repeat(40)}!`;
        discoverFiles({ 'evil.txt': payload });

        const start = Date.now();
        const result = await grepSearch('(a+)+$', '/test');

        expect(Date.now() - start).toBeLessThan(1_000);
        expect(result.content).toBe('No matches found');
      });

      it('degrades an oversized pattern to a literal search', async () => {
        const pattern = 'z'.repeat(300);
        discoverFiles({ 'file.txt': `${pattern} and needle` });

        const result = await grepSearch(pattern, '/test');

        expect(result.content).toContain('needle');
      });
    });

    it('still uses regular expressions for safe patterns', async () => {
      discoverFiles({ 'file.ts': 'const answer = 42;' });

      const result = await grepSearch('const\\s+\\w+\\s*=\\s*42', '/test');
      expect(result.content).toContain('answer');
    });

    it('returns an error when the pattern is not a valid expression', async () => {
      discoverFiles({ 'file.txt': 'content' });

      const result = await grepSearch('unclosed(', '/test');
      expect(result.error).toContain('Search failed');
    });
  });
});
