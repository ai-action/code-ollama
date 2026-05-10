import { exec } from 'node:child_process';

import { runShell } from './shell';

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

describe('shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runShell', () => {
    it('executes shell command with stdout', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: 'command output', stderr: '' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await runShell('echo hello');
      expect(result.content).toBe('command output');
    });

    it('executes shell command with stderr when stdout is empty', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(null, { stdout: '', stderr: 'error output' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await runShell('cmd');
      expect(result.content).toBe('error output');
    });

    it('returns error when command fails', async () => {
      mockExec.mockImplementation((...args: unknown[]) => {
        const callback = args[2] as (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void;
        callback(new Error('Command failed'), { stdout: '', stderr: '' });
        return undefined as unknown as ReturnType<typeof exec>;
      });

      const result = await runShell('badcmd');
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

      const result = await runShell('cmd');
      expect(result.error).toBeDefined();
    });
  });
});
