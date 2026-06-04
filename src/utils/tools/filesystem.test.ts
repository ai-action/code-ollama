import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  createDirectory,
  DEFAULT_FIND_FILES_IGNORED_DIRS,
  deletePath,
  editFile,
  findFiles,
  grepSearch,
  listDir,
  readFile,
  renamePath,
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

  describe('createDirectory', () => {
    it('creates a directory recursively', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = createDirectory('/test/nested');

      expect(result.content).toBe(
        'Directory created successfully: /test/nested',
      );
      expect(result.error).toBeUndefined();
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith('/test/nested', {
        recursive: true,
      });
    });

    it('returns success when directory already exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);

      const result = createDirectory('/existing');

      expect(result.content).toBe('Directory already exists: /existing');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });

    it('returns error when path already exists and is not a directory', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = createDirectory('/file.txt');

      expect(result.error).toBe(
        'Path already exists and is not a directory: /file.txt',
      );
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    });

    it('returns error when create fails', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = createDirectory('/test');

      expect(result.error).toContain('Failed to create directory');
      expect(result.error).toContain('Permission denied');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'create failed';
      });

      const result = createDirectory('/test');

      expect(result.error).toContain('Failed to create directory');
      expect(result.error).toContain('create failed');
    });
  });

  describe('renamePath', () => {
    it('renames a path successfully', () => {
      vi.mocked(existsSync).mockImplementation((path) => path === '/from');

      const result = renamePath('/from', '/to');

      expect(result.content).toBe('Path renamed successfully: /from -> /to');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(renameSync)).toHaveBeenCalledWith('/from', '/to');
    });

    it('returns error when source path does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = renamePath('/missing', '/to');

      expect(result.error).toBe('Source path not found: /missing');
      expect(vi.mocked(renameSync)).not.toHaveBeenCalled();
    });

    it('returns error when destination path already exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = renamePath('/from', '/existing');

      expect(result.error).toBe('Destination path already exists: /existing');
      expect(vi.mocked(renameSync)).not.toHaveBeenCalled();
    });

    it('returns error when rename fails', () => {
      vi.mocked(existsSync).mockImplementation((path) => path === '/from');
      vi.mocked(renameSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = renamePath('/from', '/to');

      expect(result.error).toContain('Failed to rename path');
      expect(result.error).toContain('Permission denied');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockImplementation((path) => path === '/from');
      vi.mocked(renameSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'rename failed';
      });

      const result = renamePath('/from', '/to');

      expect(result.error).toContain('Failed to rename path');
      expect(result.error).toContain('rename failed');
    });
  });

  describe('deletePath', () => {
    it('deletes a file', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = deletePath('/test.txt', false);

      expect(result.content).toBe('Path deleted successfully: /test.txt');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(rmSync)).toHaveBeenCalledWith('/test.txt', {
        force: false,
      });
    });

    it('deletes an empty directory without recursive mode', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([]);

      const result = deletePath('/empty', false);

      expect(result.content).toBe('Path deleted successfully: /empty');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(rmdirSync)).toHaveBeenCalledWith('/empty');
    });

    it('deletes a directory recursively when requested', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = deletePath('/directory', true);

      expect(result.content).toBe('Path deleted successfully: /directory');
      expect(result.error).toBeUndefined();
      expect(vi.mocked(rmSync)).toHaveBeenCalledWith('/directory', {
        recursive: true,
        force: false,
      });
    });

    it('returns error when path does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = deletePath('/missing', false);

      expect(result.error).toBe('Path not found: /missing');
      expect(vi.mocked(rmSync)).not.toHaveBeenCalled();
      expect(vi.mocked(rmdirSync)).not.toHaveBeenCalled();
    });

    it('returns error when directory is not empty and recursive is false', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => true,
      } as ReturnType<typeof statSync>);
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = deletePath('/directory', false);

      expect(result.error).toBe(
        'Directory is not empty; set recursive to true to delete: /directory',
      );
      expect(vi.mocked(rmSync)).not.toHaveBeenCalled();
      expect(vi.mocked(rmdirSync)).not.toHaveBeenCalled();
    });

    it('returns error when delete fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);
      vi.mocked(rmSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = deletePath('/test.txt', false);

      expect(result.error).toContain('Failed to delete path');
      expect(result.error).toContain('Permission denied');
    });

    it('handles non-Error exceptions', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);
      vi.mocked(rmSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'delete failed';
      });

      const result = deletePath('/test.txt', false);

      expect(result.error).toContain('Failed to delete path');
      expect(result.error).toContain('delete failed');
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

    it('returns error for invalid line range when start exceeds file length', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('short file');

      const result = viewRange('/test.txt', 100, 200);
      expect(result.error).toContain('Invalid line range');
    });

    it('returns error for invalid line range when start is greater than end', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = viewRange('/test.txt', 3, 1);
      expect(result.error).toContain('Invalid line range');
    });

    it('clamps end beyond file length to last line', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3');

      const result = viewRange('/test.txt', 2, 999);
      expect(result.content).toBe('line2\nline3');
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
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: '/test/file.ts:1: match line', stderr: '' });
        return {} as ReturnType<typeof exec>;
      });

      const result = await grepSearch('match', '/test');
      expect(result.content).toBe('/test/file.ts:1: match line');
    });

    it('falls through all ripgrep patterns when rg returns empty stdout', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: '', stderr: '' });
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
