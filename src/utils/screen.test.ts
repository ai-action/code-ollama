import type { MockInstance } from 'vitest';

import { clear, setClearHandler } from './screen';

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

  it('writes reset escape sequence to stdout when no handler is registered', () => {
    clear();
    expect(stdoutSpy).toHaveBeenCalledWith('\x1Bc');
  });
});
