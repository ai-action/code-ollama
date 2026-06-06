import { exec } from '../node';
import { runShell } from './shell';

vi.mock('../node', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

describe('shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runShell', () => {
    it('executes shell command with stdout', async () => {
      mockExec.mockResolvedValue({ stdout: 'command output', stderr: '' });

      const result = await runShell('echo hello');
      expect(result.content).toBe('command output');
    });

    it('executes shell command with stderr when stdout is empty', async () => {
      mockExec.mockResolvedValue({ stdout: '', stderr: 'error output' });

      const result = await runShell('cmd');
      expect(result.content).toBe('error output');
    });

    it('returns error when command fails', async () => {
      const error = Object.assign(new Error('Command failed'), {
        code: 1,
        stdout: 'stdout details',
        stderr: 'stderr details',
        stack: 'Error: Command failed\n    at test',
      });
      mockExec.mockRejectedValue(error);

      const result = await runShell('badcmd');
      expect(result.error).toBe('Command failed: exit code 1');
      expect(result.content).toBe('stdout details\nstderr details');
      expect(result.stack).toBeUndefined();
    });

    it('handles non-Error exceptions', async () => {
      mockExec.mockRejectedValue('string error');

      const result = await runShell('cmd');
      expect(result.error).toBe('Command failed: string error');
    });

    it('includes signal in error detail', async () => {
      mockExec.mockRejectedValue({ signal: 'SIGTERM' });

      const result = await runShell('cmd');
      expect(result.error).toBe('Command failed: signal SIGTERM');
    });

    it('includes killed flag in error detail', async () => {
      mockExec.mockRejectedValue({ code: 1, killed: true });

      const result = await runShell('cmd');
      expect(result.error).toBe('Command failed: exit code 1, killed');
    });

    it('uses fallback message when error object has no detail', async () => {
      mockExec.mockRejectedValue({});

      const result = await runShell('cmd');
      expect(result.error).toBe('Command failed: command exited with an error');
    });
  });
});
