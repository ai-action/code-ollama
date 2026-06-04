import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { editFile, readFile, writeFile } from '.';

vi.mock('node:fs');

describe('files', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

    it('reads a specific line range with line numbers', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        'line1\nline2\nline3\nline4\nline5',
      );

      const result = readFile('/test.txt', { endLine: 4, startLine: 2 });

      expect(result.content).toBe('2: line2\n3: line3\n4: line4');
      expect(result.error).toBeUndefined();
    });

    it('reads maxLines from the start of a file with line numbers', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = readFile('/test.txt', { maxLines: 2 });

      expect(result.content).toBe('1: line1\n2: line2');
    });

    it('reads maxLines from a startLine with line numbers', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3\nline4');

      const result = readFile('/test.txt', { maxLines: 2, startLine: 3 });

      expect(result.content).toBe('3: line3\n4: line4');
    });

    it('reads from startLine through the end of the file', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = readFile('/test.txt', { startLine: 2 });

      expect(result.content).toBe('2: line2\n3: line3');
    });

    it('clamps ranged reads beyond file length to the last line', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = readFile('/test.txt', { endLine: 999, startLine: 2 });

      expect(result.content).toBe('2: line2\n3: line3');
    });

    it('returns error for invalid line range when start exceeds file length', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('short file');

      const result = readFile('/test.txt', { endLine: 200, startLine: 100 });

      expect(result.error).toContain('Invalid line range');
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
      vi.mocked(readFileSync).mockImplementation(() => {
        const error = new Error('ENOENT');
        (error as { code?: string }).code = 'ENOENT';
        throw error;
      });

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

    it('truncates diff when it exceeds DIFF_MAX_CHARS even within line limit', () => {
      const longLine = 'x'.repeat(13_000);
      const before = 'original';

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(before);
      vi.mocked(writeFileSync).mockImplementation(() => undefined);

      const result = editFile('/test.txt', 'original', longLine);
      expect(result.content).toContain('File edited successfully');
      expect(result.diff).toBeDefined();
      expect(result.diff?.truncated).toBe(true);
      expect(result.diff?.visible).toContain('[diff truncated:');
    });

    it('produces diff with context lines when change is in the middle of a file', () => {
      const before = [
        'line one',
        'line two',
        'line three',
        'target line',
        'line five',
        'line six',
        'line seven',
      ].join('\n');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(before);
      vi.mocked(writeFileSync).mockImplementation(() => undefined);

      const result = editFile('/test.txt', 'target line', 'replaced line');
      expect(result.content).toContain('File edited successfully');
      expect(result.diff).toBeDefined();
      expect(result.diff?.visible).toContain('-target line');
      expect(result.diff?.visible).toContain('+replaced line');
      expect(result.diff?.visible).toContain(' line two');
      expect(result.diff?.visible).toContain(' line six');
    });

    it('truncates diff when it exceeds DIFF_MAX_LINES', () => {
      const removedBlock = Array.from(
        { length: 130 },
        (_, i) => `removed ${String(i)}`,
      ).join('\n');
      const before = `header\n${removedBlock}\nfooter`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(before);
      vi.mocked(writeFileSync).mockImplementation(() => undefined);

      const result = editFile('/test.txt', removedBlock, 'replacement');
      expect(result.diff?.truncated).toBe(true);
      expect(result.diff?.visible).toContain('[diff truncated:');
    });

    it('returns error when read fails', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('File not found');
    });

    it('returns error when write fails', () => {
      vi.mocked(readFileSync).mockReturnValue('before');
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('Failed to edit file');
    });

    it('returns error when write fails with non-Error', () => {
      vi.mocked(readFileSync).mockReturnValue('before');
      vi.mocked(writeFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'disk full';
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('Failed to edit file');
      expect(result.error).toContain('disk full');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'read failed';
      });

      const result = editFile('/test.txt', 'before', 'after');
      expect(result.error).toContain('File not found');
    });
  });
});
