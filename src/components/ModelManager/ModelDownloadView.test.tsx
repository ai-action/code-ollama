import { Text } from 'ink';

import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { getLastSelectProps, type MockSelectProps } from './test-utils';

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn<(props: MockSelectProps) => void>(),
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

import { ModelDownloadView } from './ModelDownloadView';

describe('ModelDownloadView', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('filters curated download options when an exact alias is already installed', async () => {
    const { lastFrame } = renderWithTheme(
      <ModelDownloadView
        installedModels={['gemma4', 'qwen2.5-coder:7b']}
        notice={null}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    await time.tick(10);

    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('Qwen 2.5 Coder');
    expect(frame).toContain('Granite 4');
    expect(frame).toContain('Enter custom model');
  });

  it('renders notice text when provided', () => {
    const { lastFrame } = renderWithTheme(
      <ModelDownloadView
        installedModels={[]}
        notice={{ tone: 'info', text: 'Already installed' }}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Already installed');
  });

  it('routes custom selection to onChange', async () => {
    const onChange = vi.fn();

    renderWithTheme(
      <ModelDownloadView
        installedModels={[]}
        notice={null}
        onCancel={vi.fn()}
        onChange={onChange}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('custom');

    expect(onChange).toHaveBeenCalledWith('custom');
  });

  it('routes back selection to onCancel', async () => {
    const onCancel = vi.fn();

    renderWithTheme(
      <ModelDownloadView
        installedModels={[]}
        notice={null}
        onCancel={onCancel}
        onChange={vi.fn()}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('back');

    expect(onCancel).toHaveBeenCalled();
  });

  it('passes curated model selections through to onChange', async () => {
    const onChange = vi.fn();

    renderWithTheme(
      <ModelDownloadView
        installedModels={[]}
        notice={null}
        onCancel={vi.fn()}
        onChange={onChange}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('qwen2.5-coder:7b');

    expect(onChange).toHaveBeenCalledWith('qwen2.5-coder:7b');
  });
});
