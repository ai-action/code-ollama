import { renderWithTheme } from '@/utils/testing';

import { ToolProgress } from './ToolProgress';

vi.mock('@inkjs/ui', () => ({
  useSpinner: () => ({ frame: 'spinner' }),
}));

describe('ToolProgress', () => {
  it('renders an animated frame for running tools', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[{ index: 0, name: 'read_file', status: 'running' }]}
      />,
    );

    expect(lastFrame()).toContain('spinner read_file: running');
  });

  it('renders failed tools', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[{ index: 0, name: 'web_fetch', status: 'failed' }]}
      />,
    );

    expect(lastFrame()).toContain('❖ web_fetch: failed');
  });
});
