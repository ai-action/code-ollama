import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
} from 'node:fs';

import { createDirectory, deletePath, listDir, renamePath } from '.';

vi.mock('node:fs');

describe('paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
