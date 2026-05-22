import { render } from 'ink-testing-library';

import { PACKAGE } from '@/constants';

import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  it('renders update available message with versions', () => {
    const { lastFrame } = render(
      <UpdateBanner currentVersion="0.20.0" latestVersion="0.21.0" />,
    );
    expect(lastFrame()).toContain('🚀 Update available!');
    expect(lastFrame()).toContain('0.20.0');
    expect(lastFrame()).toContain('0.21.0');
  });

  it('renders npm install command', () => {
    const { lastFrame } = render(
      <UpdateBanner currentVersion="0.20.0" latestVersion="0.21.0" />,
    );
    expect(lastFrame()).toContain(`npm i -g ${PACKAGE.NAME}`);
  });

  it('renders release notes URL', () => {
    const { lastFrame } = render(
      <UpdateBanner currentVersion="0.20.0" latestVersion="0.21.0" />,
    );
    expect(lastFrame()).toContain(
      `https://github.com/ai-action/${PACKAGE.NAME}/releases`,
    );
  });
});
