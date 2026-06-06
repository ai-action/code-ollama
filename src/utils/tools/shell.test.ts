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
        stdout: 'stdout details',
        stderr: 'stderr details',
        stack: 'Error: Command failed\n    at test',
      });
      mockExec.mockRejectedValue(error);

      const result = await runShell('badcmd');
      expect(result.error).toContain('Command failed');
      expect(result.content).toBe('stdout details\nstderr details');
      expect(result.stack).toContain('at test');
    });

    it('handles non-Error exceptions', async () => {
      mockExec.mockRejectedValue('string error');

      const result = await runShell('cmd');
      expect(result.error).toBeDefined();
    });
  });
});
