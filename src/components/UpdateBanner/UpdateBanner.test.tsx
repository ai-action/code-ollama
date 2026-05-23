import { render } from 'ink-testing-library';

import { PACKAGE } from '@/constants';
import { time } from '@/utils';

const checkForUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  update: { checkForUpdate },
}));

import { UpdateBanner } from './UpdateBanner';

const parts = PACKAGE.VERSION.split('.');
const newerVersion = [parts[0], parts[1], String(Number(parts[2]) + 1)].join(
  '.',
);

describe('UpdateBanner', () => {
  afterEach(() => {
    checkForUpdate.mockReset();
  });

  it('renders nothing when no update is available', async () => {
    checkForUpdate.mockResolvedValue(undefined);
    const { lastFrame, rerender } = render(<UpdateBanner />);
    await time.tick();
    rerender(<UpdateBanner />);
    expect(lastFrame()).toBe('');
  });

  it('renders update available message with versions', async () => {
    checkForUpdate.mockResolvedValue(newerVersion);
    const { lastFrame, rerender } = render(<UpdateBanner />);
    await time.tick();
    rerender(<UpdateBanner />);
    expect(lastFrame()).toContain('🚀 Update available!');
    expect(lastFrame()).toContain(PACKAGE.VERSION);
    expect(lastFrame()).toContain(newerVersion);
  });

  it('renders npm install command', async () => {
    checkForUpdate.mockResolvedValue(newerVersion);
    const { lastFrame, rerender } = render(<UpdateBanner />);
    await time.tick();
    rerender(<UpdateBanner />);
    expect(lastFrame()).toContain(`npm i -g ${PACKAGE.NAME}`);
  });

  it('renders release notes URL', async () => {
    checkForUpdate.mockResolvedValue(newerVersion);
    const { lastFrame, rerender } = render(<UpdateBanner />);
    await time.tick();
    rerender(<UpdateBanner />);
    expect(lastFrame()).toContain(
      `https://github.com/ai-action/${PACKAGE.NAME}/releases`,
    );
  });
});
