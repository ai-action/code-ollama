import { renderWithTheme } from '@/utils/testing';

import { ToolProgress } from './ToolProgress';

vi.mock('@inkjs/ui', () => ({
  useSpinner: () => ({ frame: 'spinner' }),
}));

describe('ToolProgress', () => {
  it('renders one animated summary for a tool batch', () => {
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

  it('keeps a fixed-height summary when calls settle', () => {
    const { lastFrame } = renderWithTheme(
      <ToolProgress
        progress={[
          { index: 0, name: 'web_fetch', status: 'failed' },
          { index: 1, name: 'read_file', status: 'completed' },
        ]}
      />,
    );

    expect(lastFrame()).toContain('spinner Processing 2 tool calls');
    expect(lastFrame()).not.toContain('web_fetch: failed');
    expect(lastFrame()?.split('\n')).toHaveLength(2);
  });
});
