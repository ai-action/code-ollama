import { render } from 'ink-testing-library';

import { THEME } from '@/constants';

const { mockSelect } = vi.hoisted(() => ({
  mockSelect:
    vi.fn<(props: { options: { label: string; value: string }[] }) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: (props: { options: { label: string; value: string }[] }) => {
      mockSelect(props);
      return (
        <>
          {props.options.map(({ label, value }) => (
            <Text key={value}>{label}</Text>
          ))}
        </>
      );
    },
    Spinner: ({ label }: { label?: string }) => (
      <Text>{`⏳${label ?? ''}`}</Text>
    ),
  };
});

import { ModelDeleteConfirmView } from './ModelDeleteConfirmView';

describe('ModelDeleteConfirmView', () => {
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
});
