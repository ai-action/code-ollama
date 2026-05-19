import { render } from 'ink-testing-library';

import { KEY } from '@/constants';
import { time } from '@/utils';

const { mockOnChange } = vi.hoisted(() => ({
  mockOnChange: vi.fn<(value: string) => void>(),
}));

const { mockSelect } = vi.hoisted(() => ({
  mockSelect:
    vi.fn<
      (props: {
        isDisabled?: boolean;
        options: { label: string; value: string }[];
        defaultValue?: string;
        onChange?: (value: string) => void;
      }) => void
    >(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: (props: {
      isDisabled?: boolean;
      options: { label: string; value: string }[];
      defaultValue?: string;
      onChange?: (value: string) => void;
    }) => {
      mockSelect(props);
      mockOnChange.mockImplementation((value) => props.onChange?.(value));
      return (
        <>
          <Text>{`disabled:${String(props.isDisabled ?? false)}`}</Text>
          {props.defaultValue ? (
            <Text>{`default:${props.defaultValue}`}</Text>
          ) : null}
          {props.options.map(({ value, label }) => (
            <Text key={value}>{label}</Text>
          ))}
        </>
      );
    },
  };
});

import { Text } from 'ink';

import { SelectPrompt } from './SelectPrompt';

describe('SelectPrompt', () => {
  const options = [
    { label: 'First option', value: 'first' },
    { label: 'Second option', value: 'second' },
  ];

  it('renders children above the select', () => {
    const { lastFrame } = render(
      <SelectPrompt options={options} onChange={vi.fn()}>
        <Text>Prompt text</Text>
      </SelectPrompt>,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Prompt text');
    expect(frame).toContain('First option');
    expect(frame).toContain('Second option');
  });

  beforeEach(() => {
    mockSelect.mockClear();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <SelectPrompt options={options} onChange={vi.fn()} onCancel={onCancel} />,
    );

    stdin.write(KEY.ESCAPE);
    await time.tick(20);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Ctrl+C is pressed', async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <SelectPrompt options={options} onChange={vi.fn()} onCancel={onCancel} />,
    );

    stdin.write('\x03');
    await time.tick(10);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when onCancel is not provided', async () => {
    const { stdin } = render(
      <SelectPrompt options={options} onChange={vi.fn()} />,
    );

    stdin.write(KEY.ESCAPE);
    await time.tick(10);
  });

  it('passes defaultValue through to Select', () => {
    const { lastFrame } = render(
      <SelectPrompt
        options={options}
        defaultValue="second"
        onChange={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('default:second');
  });

  it('enables selection on the next tick after mount', async () => {
    render(<SelectPrompt options={options} onChange={vi.fn()} />);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockSelect.mock.calls[0]?.[0].isDisabled).toBe(true);

    await time.tick(10);

    expect(mockSelect.mock.calls.at(-1)?.[0].isDisabled).toBe(false);
  });

  it('renders an optional borderStyle on the prompt container', () => {
    const { lastFrame } = render(
      <SelectPrompt options={options} onChange={vi.fn()} borderStyle="round">
        <Text>Prompt text</Text>
      </SelectPrompt>,
    );

    expect(lastFrame()).toContain('╭');
    expect(lastFrame()).toContain('╯');
  });

  it('forwards selection changes', () => {
    const onChange = vi.fn();
    render(<SelectPrompt options={options} onChange={onChange} />);

    mockOnChange('second');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('second');
  });
});
