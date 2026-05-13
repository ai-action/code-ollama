import type { MockInstance } from 'vitest';

import { clear, reset, setClearHandler } from './screen';

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
