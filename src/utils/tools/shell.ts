import type { ToolResult } from '@/types';

import { exec } from '../node';

// Shared shell execution options
const SHELL_EXEC_OPTIONS = {
  timeout: 30_000,
  maxBuffer: 1024 * 1024, // 1MB buffer
};

function getErrorOutput(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const output = error as { stdout?: unknown; stderr?: unknown };
  return [output.stdout, output.stderr]
    .filter((value): value is string => typeof value === 'string' && !!value)
    .join('\n');
}

/**
 * Execute shell command with shared options (throws on error)
 */
export function execShell(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return exec(command, SHELL_EXEC_OPTIONS);
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
      content: getErrorOutput(error),
      error: `Command failed: ${message}`,
      // v8 ignore next
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    };
  }
}
