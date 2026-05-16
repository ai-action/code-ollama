import { render } from 'ink-testing-library';

import { KEY } from '@/constants';
import { time } from '@/utils';

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

vi.mock('../utils', async () => ({
  ...(await vi.importActual('../utils')),
  ollama: { listModels: mockListModels },
}));

import { ModelPicker } from './ModelPicker';

describe('ModelPicker', () => {
  beforeEach(() => {
    mockListModels.mockReset();
    mockOnChange.mockReset();
    mockListModels.mockResolvedValue(['gemma4', 'llama3', 'codellama']);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading state before models arrive', () => {
    mockListModels.mockReturnValue(new Promise(() => undefined));
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Loading models');
  });

  it('renders model list after loading', async () => {
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await time.tick(10);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('gemma4');
    expect(frame).toContain('llama3');
    expect(frame).toContain('codellama');
  });

  it('renders current model first in the list', async () => {
    const { lastFrame } = render(
      <ModelPicker
        currentModel="llama3"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await time.tick(10);

    const frame = lastFrame() ?? '';
    expect(frame.indexOf('llama3')).toBeLessThan(frame.indexOf('gemma4'));
    expect(frame.indexOf('llama3')).toBeLessThan(frame.indexOf('codellama'));
  });

  it('does not inject the current model when it is not in the fetched list', async () => {
    mockListModels.mockResolvedValue(['gemma4', 'codellama']);

    const { lastFrame } = render(
      <ModelPicker
        currentModel="llama3"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await time.tick(10);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('gemma4');
    expect(frame).toContain('codellama');
    expect(frame).not.toContain('llama3');
  });

  it('reloads and reorders options when currentModel changes', async () => {
    const { lastFrame, rerender } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await time.tick(10);

    rerender(
      <ModelPicker
        currentModel="llama3"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await time.tick(10);

    const frame = lastFrame() ?? '';
    expect(mockListModels).toHaveBeenCalledTimes(2);
    expect(frame.indexOf('llama3')).toBeLessThan(frame.indexOf('gemma4'));
  });

  it('calls onSelect when a model is chosen', async () => {
    const onSelect = vi.fn();
    render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    await time.tick(10);
    mockOnChange('llama3');
    expect(onSelect).toHaveBeenCalledWith({ model: 'llama3' });
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await time.tick(10);
    stdin.write(KEY.ESCAPE);
    await time.tick(20);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose on Enter while models are loading', async () => {
    vi.useFakeTimers();
    mockListModels.mockReturnValue(new Promise(() => undefined));

    const onClose = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    stdin.write(KEY.ENTER);
    await vi.runAllTimersAsync();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Enter after models load', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick(10);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error when listModels fails', async () => {
    mockListModels.mockRejectedValue(new Error('No connection'));
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await time.tick(10);
    expect(lastFrame()).toContain('Error loading models: No connection');
  });

  it('shows error when listModels fails with non-Error', async () => {
    mockListModels.mockRejectedValue('network timeout');
    const { lastFrame } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await time.tick(10);
    expect(lastFrame()).toContain('Error loading models: network timeout');
  });

  it('does not call onClose for non-enter keys', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <ModelPicker
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await time.tick(10);
    stdin.write('a');
    await time.tick(10);
    expect(onClose).not.toHaveBeenCalled();
  });
});
