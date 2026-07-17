import type { MockInstance } from 'vitest';

import { color, dim, write, writeError } from './terminal';

describe('color', () => {
  it('wraps text with ANSI color sequences', () => {
    expect(color('code-ollama resume session-0', 'cyan')).toBe(
      '\x1B[36mcode-ollama resume session-0\x1B[39m',
    );
  });
});

describe('dim', () => {
  it('wraps text with ANSI dim sequences', () => {
    expect(dim('secondary')).toBe('\x1B[2msecondary\x1B[22m');
  });
});

describe('write', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('writes to stdout', () => {
    write('test output');
    expect(stdoutSpy).toHaveBeenCalledWith('test output');
  });
});

describe('writeError', () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('writes to stderr', () => {
    writeError('test error');
    expect(stderrSpy).toHaveBeenCalledWith('test error');
  });
});
