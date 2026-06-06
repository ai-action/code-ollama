import { Text } from 'ink';

import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

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

import { ModelDeleteView } from './ModelDeleteView';

describe('ModelDeleteView', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('filters out the current model from selectable options', async () => {
    const { lastFrame } = renderWithTheme(
      <ModelDeleteView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3', 'codellama']}
        isLoading={false}
        notice={null}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    await time.tick(10);

    const props = getLastSelectProps(mockSelect);
    expect(props.options.map((option) => option.value)).not.toContain('gemma4');
    expect(lastFrame()).toContain('current model gemma4 cannot be deleted');
  });

  it('renders notice text when provided', () => {
    const { lastFrame } = renderWithTheme(
      <ModelDeleteView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3']}
        isLoading={false}
        notice={{ tone: 'error', text: 'Delete failed' }}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Delete failed');
  });

  it('calls onSelect for a selected model', async () => {
    const onSelect = vi.fn();

    renderWithTheme(
      <ModelDeleteView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3']}
        isLoading={false}
        notice={null}
        onCancel={vi.fn()}
        onSelect={onSelect}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('llama3');

    expect(onSelect).toHaveBeenCalledWith('llama3');
  });

  it('calls onCancel when back is selected', async () => {
    const onCancel = vi.fn();

    renderWithTheme(
      <ModelDeleteView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3']}
        isLoading={false}
        notice={null}
        onCancel={onCancel}
        onSelect={vi.fn()}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('back');

    expect(onCancel).toHaveBeenCalled();
  });

  it('renders a spinner while loading', () => {
    const { lastFrame } = renderWithTheme(
      <ModelDeleteView
        currentModel="gemma4"
        installedModels={[]}
        isLoading
        notice={null}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Loading models');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
