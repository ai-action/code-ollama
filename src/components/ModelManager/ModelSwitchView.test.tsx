import { Text } from 'ink';
import { render } from 'ink-testing-library';

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

import { ModelSwitchView } from './ModelSwitchView';

describe('ModelSwitchView', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('renders installed model options with Back', async () => {
    const { lastFrame } = render(
      <ModelSwitchView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3', 'codellama']}
        isLoading={false}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    await time.tick(10);

    expect(lastFrame()).toContain('gemma4');
    expect(lastFrame()).toContain('llama3');
    expect(lastFrame()).toContain('Back');
  });

  it('calls onSelect for a selected model', async () => {
    const onSelect = vi.fn();

    render(
      <ModelSwitchView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3']}
        isLoading={false}
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

    render(
      <ModelSwitchView
        currentModel="gemma4"
        installedModels={['gemma4', 'llama3']}
        isLoading={false}
        onCancel={onCancel}
        onSelect={vi.fn()}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('back');

    expect(onCancel).toHaveBeenCalled();
  });

  it('renders a spinner while loading', () => {
    const { lastFrame } = render(
      <ModelSwitchView
        currentModel="gemma4"
        installedModels={[]}
        isLoading
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Loading models');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
