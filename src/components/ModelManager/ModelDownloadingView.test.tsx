import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { THEME } from '@/constants';
import { time } from '@/utils';

import { getLastSelectProps, type MockSelectProps } from './test-utils';

const { mockProgressBar, mockSelect } = vi.hoisted(() => ({
  mockProgressBar: vi.fn<(value: number) => void>(),
  mockSelect: vi.fn<(props: MockSelectProps) => void>(),
}));

vi.mock('@inkjs/ui', () => ({
  ProgressBar: ({ value }: { value: number }) => {
    mockProgressBar(value);
    return <Text>{`Progress:${String(value)}`}</Text>;
  },
}));

vi.mock('../SelectPrompt', () => ({
  SelectPrompt: ({
    children,
    ...props
  }: MockSelectProps & { children?: React.ReactNode }) => {
    mockSelect(props);
    return (
      <>
        {children}
        {props.options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },
  SelectPromptHint: ({ message }: { message?: string }) => (
    <Text>{message}</Text>
  ),
}));

import { ModelDownloadingView } from './ModelDownloadingView';

describe('ModelDownloadingView', () => {
  beforeEach(() => {
    mockProgressBar.mockReset();
    mockSelect.mockReset();
  });

  it('renders percentage, bytes, and progress bar when progress is available', async () => {
    const { lastFrame } = render(
      <ModelDownloadingView
        progress={{
          model: 'qwen2.5-coder:7b',
          status: 'downloading',
          completed: 50,
          total: 100,
        }}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
      />,
    );

    await time.tick(10);

    expect(lastFrame()).toContain('Downloading model');
    expect(lastFrame()).toContain('50%');
    expect(lastFrame()).toContain('50 B / 100 B');
    expect(mockProgressBar).toHaveBeenCalledWith(50);
  });

  it('keeps completed progress visible at 100 percent', async () => {
    const { lastFrame } = render(
      <ModelDownloadingView
        progress={{
          model: 'qwen2.5-coder:7b',
          status: 'verifying',
          completed: 100,
          total: 100,
        }}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
      />,
    );

    await time.tick(10);

    expect(lastFrame()).toContain('verifying');
    expect(lastFrame()).toContain('100%');
    expect(mockProgressBar).toHaveBeenLastCalledWith(100);
  });

  it('shows large file sizes with converted units', async () => {
    const { lastFrame } = render(
      <ModelDownloadingView
        progress={{
          model: 'qwen2.5-coder:7b',
          status: 'downloading',
          completed: 2.5 * 1024 * 1024 * 1024,
          total: 5 * 1024 * 1024 * 1024,
        }}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
      />,
    );

    await time.tick(10);

    expect(lastFrame()).toContain('GB');
  });

  it('shows unavailable progress details when totals are missing', async () => {
    const { lastFrame } = render(
      <ModelDownloadingView
        progress={{
          model: 'qwen2.5-coder:7b',
          status: 'waiting',
          completed: 0,
          total: 0,
        }}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
      />,
    );

    await time.tick(10);

    expect(lastFrame()).toContain('Progress details unavailable');
    expect(mockProgressBar).not.toHaveBeenCalled();
  });

  it('calls onCancel from the cancel prompt', async () => {
    const onCancel = vi.fn();

    render(
      <ModelDownloadingView
        progress={{
          model: 'qwen2.5-coder:7b',
          status: 'downloading',
          completed: 50,
          total: 100,
        }}
        theme={THEME.getTheme()}
        onCancel={onCancel}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('cancel-download');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
