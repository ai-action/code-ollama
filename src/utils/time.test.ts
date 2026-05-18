import { tick } from './time';

describe('time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tick', () => {
    it('resolves after the specified milliseconds', async () => {
      const promise = tick(50);

      vi.advanceTimersByTime(50);

      await expect(promise).resolves.toBeUndefined();
    });

    it('resolves immediately with 0 ms', async () => {
      const promise = tick();

      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
