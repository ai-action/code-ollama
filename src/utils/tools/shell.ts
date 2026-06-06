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

function getErrorDetail(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  const details = error as {
    code?: unknown;
    signal?: unknown;
    killed?: unknown;
  };
  const parts = [
    typeof details.code === 'number' || typeof details.code === 'string'
      ? `exit code ${String(details.code)}`
      : '',
    typeof details.signal === 'string' ? `signal ${details.signal}` : '',
    details.killed === true ? 'killed' : '',
  ].filter(Boolean);

  return parts.join(', ') || 'command exited with an error';
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
    return {
      content: getErrorOutput(error),
      error: `Command failed: ${getErrorDetail(error)}`,
    };
  }
}
