import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { THEME } from '@/constants';
import { time } from '@/utils';

import { getLastSelectProps, type MockSelectProps } from './test-utils';

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn<(props: MockSelectProps) => void>(),
}));

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <Text>{`⏳${label ?? ''}`}</Text>,
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

import { ModelDeleteConfirmView } from './ModelDeleteConfirmView';

describe('ModelDeleteConfirmView', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('renders confirm options with no notice when notice is null', () => {
    const { lastFrame } = render(
      <ModelDeleteConfirmView
        deleteCandidate="llama3"
        isDeleting={false}
        notice={null}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(lastFrame()).toContain('llama3');
    expect(lastFrame()).not.toContain('error');
  });

  it('renders spinner when isDeleting is true', () => {
    const { lastFrame } = render(
      <ModelDeleteConfirmView
        deleteCandidate="llama3"
        isDeleting
        notice={null}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(lastFrame()).toContain('Deleting model llama3');
  });

  it('renders notice text when notice is provided', () => {
    const { lastFrame } = render(
      <ModelDeleteConfirmView
        deleteCandidate="llama3"
        isDeleting={false}
        notice={{ tone: 'error', text: 'Something went wrong' }}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(lastFrame()).toContain('Something went wrong');
  });

  it('calls onConfirm when delete is selected', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ModelDeleteConfirmView
        deleteCandidate="llama3"
        isDeleting={false}
        notice={null}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('delete');

    expect(onConfirm).toHaveBeenCalledWith('delete');
  });

  it('passes non-delete selections through to onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ModelDeleteConfirmView
        deleteCandidate="llama3"
        isDeleting={false}
        notice={null}
        theme={THEME.getTheme()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('back');

    expect(onConfirm).toHaveBeenCalledWith('back');
  });
});
