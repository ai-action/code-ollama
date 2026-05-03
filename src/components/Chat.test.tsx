import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { tick } from '../utils/test';

const mockState = vi.hoisted(() => ({
  handlers: [] as ((value: string) => void)[],
  testInput: '',
  shouldReset: false,
  clear() {
    this.handlers.length = 0;
    this.testInput = '';
    this.shouldReset = true;
  },
}));

vi.mock('./Messages', () => ({
  Messages: ({
    messages,
    isLoading,
  }: {
    messages: { role: string; content: string }[];
    isLoading: boolean;
  }) => (
    <>
      {messages.map((m, i) => (
        <Text key={i}>{m.content}</Text>
      ))}
      {isLoading && messages[messages.length - 1]?.content === '' && (
        <Text>⏳Thinking...</Text>
      )}
    </>
  ),
}));

vi.mock('./Autocomplete', () => ({
  Autocomplete: (props: {
    onSubmit?: (value: string) => void;
    isDisabled?: boolean;
  }) => {
    if (props.onSubmit) {
      mockState.handlers.push(props.onSubmit);
    }

    if (props.isDisabled) {
      return null;
    }

    const displayValue = mockState.shouldReset
      ? ((mockState.shouldReset = false), '')
      : mockState.testInput;

    return (
      <Text>
        {'>'}
        {displayValue}
      </Text>
    );
  },
}));

import { Chat } from './Chat';

vi.mock('../utils', () => ({
  ollama: {
    streamChat: vi.fn().mockImplementation(function* () {
      yield { type: 'content', content: 'Mocked' };
      yield { type: 'content', content: ' response' };
    }),
  },
  tools: {
    TOOLS: [],
    TOOLS_REQUIRING_APPROVAL: new Set(),
    executeTool: vi.fn(),
  },
}));

async function typeText(
  rerender: (tree: React.ReactElement) => void,
  text: string,
  tree: React.ReactElement,
) {
  mockState.testInput = text;
  rerender(tree);
  await tick();
}

function submitInput(value: string) {
  for (const handler of mockState.handlers) {
    handler(value);
  }
  mockState.clear();
}

async function waitForStream() {
  // Allow time for async generator to yield values
  await tick(10);
}

describe('Chat', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('renders input prompt', () => {
    const { lastFrame } = render(<Chat model="gemma4" onCommand={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('shows message after submit', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    expect(lastFrame()).toContain('hello');
  });

  it('clears input after submit', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    // Verify the user message appears in the chat
    expect(lastFrame()).toContain('hello');
  });

  it('does not add blank messages', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, '   ', chat);
    submitInput('   ');
    rerender(chat);
    await tick();
    const frame = lastFrame() ?? '';
    const lines = frame
      .split('\n')
      .filter(
        (line) => line.trim() && !line.includes('>') && !line.includes('Mode:'),
      );
    expect(lines).toHaveLength(0);
  });

  it('shows multiple messages in order', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'first', chat);
    submitInput('first');
    rerender(chat);
    await waitForStream();
    await typeText(rerender, 'second', chat);
    submitInput('second');
    rerender(chat);
    await waitForStream();
    const frame = lastFrame() ?? '';
    const firstIdx = frame.indexOf('first');
    const secondIdx = frame.indexOf('second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('calls onCommand when a slash command is submitted', async () => {
    const onCommand = vi.fn();
    const chat = <Chat model="gemma4" onCommand={onCommand} />;
    const { rerender } = render(chat);
    submitInput('/model');
    rerender(chat);
    await tick();
    expect(onCommand).toHaveBeenCalledWith('/model');
  });

  it('passes model prop to streamChat', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockClear();

    const chat = <Chat model="llama3" onCommand={vi.fn()} />;
    const { rerender } = render(chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(vi.mocked(streamChat)).toHaveBeenLastCalledWith(
      expect.any(Array),
      'llama3',
      expect.any(Array),
    );
  });
});

describe('Chat keyboard shortcuts', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('toggles autoExecute mode with Shift+Tab', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, stdin } = render(chat);

    // Initial state should show "Smart" mode
    expect(lastFrame()).toContain('Mode: Smart');

    // Send Shift+Tab escape sequence
    stdin.write('\x1B[Z');
    await tick();

    // After Shift+Tab, should show "Auto" mode
    expect(lastFrame()).toContain('Mode: Auto');

    // Toggle back with another Shift+Tab
    stdin.write('\x1B[Z');
    await tick();

    expect(lastFrame()).toContain('Mode: Smart');
  });
});

describe('Chat with tool calls', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('shows tool approval when tool requires approval', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'write_file',
              arguments: { path: '/test.txt', content: 'hello' },
            },
          },
        ],
      };
    });

    // Set write_file as requiring approval
    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(true);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Tool requires approval');
  });

  it('auto-executes tool that does not require approval', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: '/test.txt' },
            },
          },
        ],
      };
    });

    // Mock executeTool to return content (auto-executed since read_file doesn't require approval)
    const mockExecute = vi.fn().mockResolvedValue({
      content: 'file contents',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    // read_file does not require approval
    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(false);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { rerender } = render(chat);

    await typeText(rerender, 'read file', chat);
    submitInput('read file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).toHaveBeenCalledWith('read_file', {
      path: '/test.txt',
    });
  });

  it('handles tool result error', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: '/missing.txt' },
            },
          },
        ],
      };
    });

    // Use local mock implementation for executeTool
    const mockExecute = vi.fn().mockResolvedValue({
      content: '',
      error: 'File not found',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    // read_file does not require approval
    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(false);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'read file', chat);
    submitInput('read file');
    rerender(chat);
    await waitForStream();

    // The tool result message should contain the error
    expect(lastFrame()).toContain('File not found');
  });

  it('handles tool approval rejection', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'write_file',
              arguments: { path: '/test.txt', content: 'hello' },
            },
          },
        ],
      };
    });

    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(true);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender, stdin } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // Verify approval prompt is shown
    expect(lastFrame()).toContain('Tool requires approval');

    // Reject the tool (move to No with right arrow, then Enter)
    stdin.write('\x1B[C'); // Right arrow
    await tick();
    stdin.write('\r'); // Enter
    await tick();
    rerender(chat);

    // Should show rejection message
    expect(lastFrame()).toContain('declined');
  });

  it('handles tool approval acceptance', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'write_file',
              arguments: { path: '/test.txt', content: 'hello' },
            },
          },
        ],
      };
    });

    // Second call after tool execution
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done' };
    });

    const mockExecute = vi.fn().mockResolvedValue({
      content: 'File written successfully',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(true);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender, stdin } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // Verify approval prompt is shown
    expect(lastFrame()).toContain('Tool requires approval');

    // Approve the tool by pressing Enter (yes is default)
    stdin.write('\r'); // Enter
    await tick();
    rerender(chat);

    // Should have called executeTool
    expect(mockExecute).toHaveBeenCalledWith('write_file', {
      path: '/test.txt',
      content: 'hello',
    });
  });

  it('handles tool result with error in approval flow', async () => {
    const { ollama, tools } = await import('../utils');
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'write_file',
              arguments: { path: '/test.txt', content: 'hello' },
            },
          },
        ],
      };
    });

    // Second call after tool execution (with error)
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Error handled' };
    });

    const mockExecute = vi.fn().mockResolvedValue({
      content: '',
      error: 'Permission denied',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    vi.spyOn(tools.TOOLS_REQUIRING_APPROVAL, 'has').mockReturnValue(true);

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { rerender, stdin } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // Approve the tool by pressing Enter
    stdin.write('\r');
    await tick();
    rerender(chat);

    // Should have called executeTool
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('Chat with error', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('shows error message when stream fails with Error', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
      throw new Error('Connection failed');
    });

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Connection failed');
  });

  it('shows error message when stream fails with non-Error', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { toString: () => 'Custom error' };
    });

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Custom error');
  });
});
