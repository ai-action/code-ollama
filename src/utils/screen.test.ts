import type { MockInstance } from 'vitest';

import { clear, color, reset, setClearHandler, write } from './screen';

describe('clear', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    setClearHandler(null);
    stdoutSpy.mockRestore();
  });

  it('uses the registered clear handler when available', () => {
    const handler = vi.fn();
    setClearHandler(handler);

    clear();

    expect(handler).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('does nothing when no handler is registered', () => {
    clear();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe('reset', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('writes the ANSI full-reset escape sequence', () => {
    reset();
    expect(stdoutSpy).toHaveBeenCalledWith('\x1Bc\x1B[?25l');
  });
});

describe('color', () => {
  it('wraps text with ANSI color sequences', () => {
    expect(color('code-ollama resume session-0', 'cyan')).toBe(
      '\x1B[36mcode-ollama resume session-0\x1B[39m',
    );
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
