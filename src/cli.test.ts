import { type MockInstance, vi } from 'vitest';

import { main } from './cli';

describe('cli', () => {
  let consoleSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('prints name and hint with no args', () => {
    main([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'code-ollama – use --version to print the name',
    );
  });

  it('prints name with --version', () => {
    main(['--version']);
    expect(consoleSpy).toHaveBeenCalledWith('code-ollama');
  });

  it('prints name with -v', () => {
    main(['-v']);
    expect(consoleSpy).toHaveBeenCalledWith('code-ollama');
  });
});
