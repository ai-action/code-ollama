import { render } from 'ink-testing-library';

import { KEY } from '../constants';
import { tick } from '../utils/test';

const { mockListModels, mockOnChange } = vi.hoisted(() => ({
  mockListModels: vi.fn(),
  mockOnChange: vi.fn<(value: string) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Spinner: ({ label }: { label?: string }) => (
      <Text>{`⏳${label ?? ''}`}</Text>
    ),
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: string }[];
      defaultValue?: string;
      onChange?: (value: string) => void;
    }) => {
      mockOnChange.mockImplementation((v) => onChange?.(v));
      return (
        <>
          {options.map(({ value, label }) => (
            <Text key={value}>{label}</Text>
          ))}
        </>
      );
    },
  };
});

vi.mock('../utils', () => ({
  ollama: { listModels: mockListModels },
}));

import { ModelPicker } from './ModelPicker';

describe('ModelPicker', () => {
  beforeEach(() => {
    mockListModels.mockResolvedValue(['gemma4', 'llama3', 'codellama']);
  });

  it('shows loading state before models arrive', () => {
    mockListModels.mockReturnValue(new Promise(() => undefined));
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Loading models');
  });

  it('renders model list after loading', async () => {
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick(10);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('gemma4');
    expect(frame).toContain('llama3');
    expect(frame).toContain('codellama');
  });

  it('renders current model in list', async () => {
    const { lastFrame } = render(
      <ModelPicker
        currentModel="llama3"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick(10);
    expect(lastFrame()).toContain('llama3');
  });

  it('calls onSelect when a model is chosen', async () => {
    const onSelect = vi.fn();
    render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await tick(10);
    mockOnChange('llama3');
    expect(onSelect).toHaveBeenCalledWith('llama3');
  });

  it('calls onCancel on Escape', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await tick(10);
    stdin.write(KEY.ESCAPE);
    await tick(50);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error when listModels fails', async () => {
    mockListModels.mockRejectedValue(new Error('No connection'));
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick(10);
    expect(lastFrame()).toContain('Error loading models: No connection');
  });

  it('shows error when listModels fails with non-Error', async () => {
    mockListModels.mockRejectedValue('network timeout');
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await tick(10);
    expect(lastFrame()).toContain('Error loading models: network timeout');
  });

  it('does not call onCancel for non-escape keys', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await tick(10);
    stdin.write('a');
    await tick(10);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
