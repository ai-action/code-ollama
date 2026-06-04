import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
} from 'node:fs';

import type { ToolResult } from '@/types';

/**
 * Create a directory and any missing parent directories
 */
export function createDirectory(dirPath: string): ToolResult {
  try {
    if (existsSync(dirPath)) {
      if (statSync(dirPath).isDirectory()) {
        return { content: `Directory already exists: ${dirPath}` };
      }

      return {
        content: '',
        error: `Path already exists and is not a directory: ${dirPath}`,
      };
    }

    mkdirSync(dirPath, { recursive: true });
    return { content: `Directory created successfully: ${dirPath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Rename or move an existing file or directory
 */
export function renamePath(fromPath: string, toPath: string): ToolResult {
  try {
    if (!existsSync(fromPath)) {
      return { content: '', error: `Source path not found: ${fromPath}` };
    }

    if (existsSync(toPath)) {
      return {
        content: '',
        error: `Destination path already exists: ${toPath}`,
      };
    }

    renameSync(fromPath, toPath);
    return { content: `Path renamed successfully: ${fromPath} -> ${toPath}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to rename path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Delete a file or directory
 */
export function deletePath(path: string, recursive: boolean): ToolResult {
  try {
    if (!existsSync(path)) {
      return { content: '', error: `Path not found: ${path}` };
    }

    const stats = statSync(path);
    if (stats.isDirectory()) {
      const entries = readdirSync(path);
      if (entries.length > 0 && !recursive) {
        return {
          content: '',
          error: `Directory is not empty; set recursive to true to delete: ${path}`,
        };
      }

      if (recursive) {
        rmSync(path, { recursive: true, force: false });
      } else {
        rmdirSync(path);
      }
    } else {
      rmSync(path, { force: false });
    }

    return { content: `Path deleted successfully: ${path}` };
  } catch (error) {
    return {
      content: '',
      error: `Failed to delete path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List directory contents
 */
export function listDir(dirPath: string): ToolResult {
  try {
    if (!existsSync(dirPath)) {
      return { content: '', error: `Directory not found: ${dirPath}` };
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const lines = entries.map((entry) => {
      const type = entry.isDirectory() ? 'd' : 'f';
      return `[${type}] ${entry.name}`;
    });
    return { content: lines.join('\n') };
  } catch (error) {
    return {
      content: '',
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
