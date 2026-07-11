import { renderWithTheme } from '@/utils/testing';

import { ToolProgress } from './ToolProgress';

vi.mock('@inkjs/ui', () => ({
  useSpinner: () => ({ frame: 'spinner' }),
}));

describe('ToolProgress', () => {
  it('renders one animated summary for active tools', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[
          { index: 0, name: 'read_file', status: 'running' },
          { index: 1, name: 'list_dir', status: 'queued' },
        ]}
      />,
    );

    expect(lastFrame()).toContain('spinner Processing 2 tool calls');
    expect(lastFrame()).not.toContain('read_file: running');
    expect(lastFrame()).not.toContain('list_dir: queued');
  });

  it('renders failed tools', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[{ index: 0, name: 'web_fetch', status: 'failed' }]}
      />,
    );

    expect(lastFrame()).toContain('❖ web_fetch: failed');
  });

  it('renders settled tools below the active summary', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[
          { index: 0, name: 'read_file', status: 'completed' },
          { index: 1, name: 'list_dir', status: 'running' },
        ]}
      />,
    );

    expect(lastFrame()).toContain('spinner Processing 2 tool calls');
    expect(lastFrame()).toContain('❖ read_file: completed');
  });
});
