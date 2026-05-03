import { render } from 'ink-testing-library';

import { KEY } from '../constants';
import { tick } from '../utils/test';
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
      <ToolApproval
        toolCall={toolCall}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('read_file');
    expect(lastFrame()).toContain('Tool requires approval');
  });

  it('calls onApprove when Enter is pressed with yes selected', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const toolCall = createToolCall();

    const { stdin } = render(
      <ToolApproval
        toolCall={toolCall}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    stdin.write(KEY.ENTER);
    await tick();

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
  });

  it('calls onReject when switching to no and pressing Enter', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const toolCall = createToolCall();

    const { stdin } = render(
      <ToolApproval
        toolCall={toolCall}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    // Move selection to 'no' with right arrow, then press Enter
    stdin.write(KEY.RIGHT);
    await tick();
    stdin.write(KEY.ENTER);
    await tick();

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('toggles selection with right arrow key', async () => {
    const toolCall = createToolCall();

    const { lastFrame, stdin } = render(
      <ToolApproval
        toolCall={toolCall}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    // Toggle to no with right arrow
    stdin.write(KEY.RIGHT);
    await tick();

    expect(lastFrame()).toContain('Yes');
  });

  it('toggles selection with left arrow key', async () => {
    const toolCall = createToolCall();

    const { lastFrame, stdin } = render(
      <ToolApproval
        toolCall={toolCall}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    // Move right first, then back with left
    stdin.write(KEY.RIGHT);
    await tick();
    stdin.write(KEY.LEFT);
    await tick();

    expect(lastFrame()).toContain('Yes');
  });

  it('formats JSON arguments nicely', () => {
    const toolCall = createToolCall('write_file', {
      path: '/test.txt',
      content: 'hello',
    });
    const { lastFrame } = render(
      <ToolApproval
        toolCall={toolCall}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('path');
    expect(lastFrame()).toContain('content');
  });
});
