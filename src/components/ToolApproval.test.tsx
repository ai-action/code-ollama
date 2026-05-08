import { render } from 'ink-testing-library';

import { DECISION, KEY } from '../constants';
import { time } from '../utils';

const { mockOnChange } = vi.hoisted(() => ({
  mockOnChange: vi.fn<(value: DECISION.Decision) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: DECISION.Decision }[];
      defaultValue?: DECISION.Decision;
      onChange?: (value: DECISION.Decision) => void;
    }) => {
      mockOnChange.mockImplementation((value) => onChange?.(value));
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

import { ToolApproval } from './ToolApproval';

describe('ToolApproval', () => {
  const createToolCall = (
    name = 'test_tool',
    args: Record<string, unknown> = {},
  ) => ({
    function: {
      name,
      arguments: args,
    },
  });

  it('renders tool name and arguments', () => {
    const toolCall = createToolCall('read_file', { path: '/test.txt' });
    const { lastFrame } = render(
      <ToolApproval toolCall={toolCall} onDecision={vi.fn()} />,
    );

    expect(lastFrame()).toContain('read_file');
    expect(lastFrame()).toContain('Tool requires approval');
  });

  it('calls onDecision with approve when approve is chosen', () => {
    const onDecision = vi.fn();
    render(
      <ToolApproval toolCall={createToolCall()} onDecision={onDecision} />,
    );

    mockOnChange(DECISION.APPROVE);

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(DECISION.APPROVE);
  });

  it('calls onDecision with reject when reject is chosen', () => {
    const onDecision = vi.fn();
    render(
      <ToolApproval toolCall={createToolCall()} onDecision={onDecision} />,
    );

    mockOnChange(DECISION.REJECT);

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(DECISION.REJECT);
  });

  it('formats JSON arguments nicely', () => {
    const toolCall = createToolCall('write_file', {
      path: '/test.txt',
      content: 'hello',
    });
    const { lastFrame } = render(
      <ToolApproval toolCall={toolCall} onDecision={vi.fn()} />,
    );

    expect(lastFrame()).toContain('path');
    expect(lastFrame()).toContain('content');
  });

  it('calls onDecision with reject when Escape is pressed', async () => {
    const onDecision = vi.fn();
    const { stdin } = render(
      <ToolApproval toolCall={createToolCall()} onDecision={onDecision} />,
    );

    stdin.write(KEY.ESCAPE);
    await time.tick(20);

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(DECISION.REJECT);
  });

  it('ignores non-escape keys', async () => {
    const onDecision = vi.fn();
    const { stdin } = render(
      <ToolApproval toolCall={createToolCall()} onDecision={onDecision} />,
    );

    stdin.write(KEY.ENTER);
    await time.tick(20);

    expect(onDecision).not.toHaveBeenCalled();
  });
});
