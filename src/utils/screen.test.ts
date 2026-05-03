import type { MockInstance } from 'vitest';

import { clear } from './screen';

describe('clear', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('writes reset escape sequence to stdout', () => {
    clear();
    expect(stdoutSpy).toHaveBeenCalledWith('\x1Bc');
  });
});
