import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import type { ToolResult } from '../../types';

const execAsync = promisify(exec);

// Shared shell execution options
const SHELL_EXEC_OPTIONS = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024, // 1MB buffer
};

/**
 * Execute shell command with shared options (throws on error)
 */
export function execShell(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(command, SHELL_EXEC_OPTIONS);
}

/**
 * Execute shell command
 */
export async function runShell(command: string): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execShell(command);
    return { content: stdout || stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: '',
      error: `Command failed: ${message}`,
    };
  }
}
