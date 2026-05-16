import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { DECISION, MODE, THEME } from '../../constants';
import type { Decision } from '../../types';
import { ollama, time, tools } from '../../utils';
import { prewarmCodeBlocks } from '../CodeBlock';

const mockState = vi.hoisted(() => ({
  handler: undefined as ((value: string) => void) | undefined,
  history: [] as string[],
  testInput: '',
  shouldReset: false,
  clear() {
    this.handler = undefined;
    this.history = [];
    this.testInput = '';
    this.shouldReset = true;
  },
}));

const toolApprovalState = vi.hoisted(() => ({
  onChange: undefined as ((value: string) => void) | undefined,
  clear() {
    this.onChange = undefined;
  },
}));

const planApprovalState = vi.hoisted(() => ({
  onChange: undefined as ((value: string) => void) | undefined,
  clear() {
    this.onChange = undefined;
  },
}));

const interruptState = vi.hoisted(() => ({
  handler: undefined as (() => void) | undefined,
  clear() {
    this.handler = undefined;
  },
}));

vi.mock('@inkjs/ui', async () => {
  const actual = await vi.importActual('@inkjs/ui');
  const { Text } = await import('ink');
  return {
    ...actual,
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: string }[];
      onChange?: (value: string) => void;
    }) => {
      const isPlanApproval = options.some(({ value }) =>
        [MODE.SAFE, MODE.AUTO, MODE.PLAN].includes(value),
      );

      if (isPlanApproval) {
        planApprovalState.onChange = onChange;
      } else {
        toolApprovalState.onChange = onChange;
      }

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

vi.mock('../CodeBlock', async () => ({
  ...(await vi.importActual('../CodeBlock')),
  prewarmCodeBlocks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils', async () => ({
  ...(await vi.importActual('../../utils')),
  ollama: {
    streamChat: vi.fn().mockImplementation(function* () {
      yield { type: 'content', content: 'Mocked' };
      yield { type: 'content', content: ' response' };
    }),
  },
  tools: {
    TOOLS: [],
    READ_TOOLS: new Set(),
    WRITE_TOOLS: new Set(),
    executeTool: vi.fn(),
  },
}));

vi.mock('./ChatInput', () => ({
  ChatInput: (props: {
    history?: string[];
    onSubmit?: (value: string) => void;
    onInterrupt?: () => void;
    isDisabled?: boolean;
  }) => {
    if (props.onSubmit) {
      mockState.handler = props.onSubmit;
    }

    mockState.history = props.history ?? [];

    if (props.onInterrupt) {
      interruptState.handler = props.onInterrupt;
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

async function typeText(
  rerender: (tree: React.ReactElement) => void,
  text: string,
  tree: React.ReactElement,
) {
  mockState.testInput = text;
  rerender(tree);
  await time.tick();
}

function submitInput(value: string) {
  mockState.handler?.(value);
  mockState.clear();
}

function choosePlanMode(mode: string) {
  planApprovalState.onChange?.(mode);
}

function chooseToolDecision(decision: Decision) {
  toolApprovalState.onChange?.(decision);
}

async function waitForStream() {
  // Allow time for async generator to yield values
  await time.tick(10);
}

function fireInterrupt() {
  interruptState.handler?.();
}

function resetChatMocks() {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockState.clear();
  planApprovalState.clear();
  toolApprovalState.clear();
  interruptState.clear();
  tools.TOOLS.splice(0, tools.TOOLS.length);
  vi.mocked(ollama.streamChat).mockImplementation(async function* () {
    await Promise.resolve();
    yield { type: 'content', content: 'Mocked' };
    yield { type: 'content', content: ' response' };
  });
  vi.mocked(tools.executeTool).mockReset();
}

describe('Chat', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  const onModeChange = vi.fn();

  it('renders input prompt without system message', async () => {
    const { lastFrame } = render(
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />,
    );
    await time.tick();
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('coding assistant');
    expect(frame).toContain('>');
  });

  it('shows message after submit', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);
    await time.tick();
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('hello');
  }, 10_000);

  it('derives prompt history from user messages and excludes slash commands', async () => {
    render(
      <Chat
        initialMessages={[
          { role: 'user', content: 'first prompt' },
          { role: 'assistant', content: 'response' },
          { role: 'user', content: '/model' },
          { role: 'user', content: 'second prompt' },
        ]}
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />,
    );

    await time.tick();

    expect(mockState.history).toEqual(['first prompt', 'second prompt']);
  });

  it('does not add blank messages', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);
    await time.tick();
    const beforeFrame = lastFrame() ?? '';
    const systemLineCount = beforeFrame.split('\n').length;
    await typeText(rerender, '   ', chat);
    submitInput('   ');
    rerender(chat);
    await time.tick();
    const afterFrame = lastFrame() ?? '';
    const afterLineCount = afterFrame.split('\n').length;
    // After submitting blank input, line count should not increase
    // (no new user message added)
    expect(afterLineCount).toBe(systemLineCount);
    expect(afterFrame).not.toContain('coding assistant');
  });

  it('shows multiple messages in order', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);
    await time.tick();
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
  }, 10_000);

  it('prewarms code blocks before committing a streamed response', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Here:\n```ts\nconst x = 1;\n```' };
    });
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);
    await time.tick();
    submitInput('show me code');
    rerender(chat);
    await waitForStream();
    expect(vi.mocked(prewarmCodeBlocks)).toHaveBeenCalledWith(
      'Here:\n```ts\nconst x = 1;\n```',
      THEME.getTheme(),
    );
  }, 10_000);

  it('calls onCommand when a slash command is submitted', async () => {
    const onCommand = vi.fn();
    const chat = (
      <Chat
        model="gemma4"
        onCommand={onCommand}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);
    submitInput('/model');
    rerender(chat);
    await time.tick();
    expect(onCommand).toHaveBeenCalledWith('/model');
  });

  it('resets the session state when sessionId changes', async () => {
    const renderChat = (sessionId: string) => (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId={sessionId}
      />
    );

    const { lastFrame, rerender } = render(renderChat('0'));
    await time.tick();

    await typeText(rerender, 'hello', renderChat('0'));
    submitInput('hello');
    rerender(renderChat('0'));
    await waitForStream();
    expect(lastFrame()).toContain('hello');

    vi.mocked(ollama.streamChat).mockClear();

    rerender(renderChat('1'));
    await time.tick();

    expect(lastFrame()).toContain('>');

    await typeText(rerender, 'fresh', renderChat('1'));
    submitInput('fresh');
    rerender(renderChat('1'));
    await waitForStream();

    const firstCallMessages = vi.mocked(ollama.streamChat).mock.calls[0]?.[0];
    expect(firstCallMessages).toEqual(
      expect.arrayContaining([{ role: 'user', content: 'fresh' }]),
    );
    expect(firstCallMessages).toEqual(
      expect.not.arrayContaining([{ role: 'user', content: 'hello' }]),
    );
  }, 10_000);

  it('passes model prop to streamChat', async () => {
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockClear();

    const chat = (
      <Chat
        model="llama3"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(vi.mocked(streamChat)).toHaveBeenLastCalledWith(
      expect.any(Array),
      'llama3',
      expect.any(Array),
      expect.any(AbortSignal),
    );
  });

  it('shows blocked policy details when a tool is denied by policy', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: '/blocked.txt' },
            },
          },
        ],
      };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({
      content: '',
      error: 'Tool not allowed: read_file',
    });
    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(false);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'read blocked file', chat);
    submitInput('read blocked file');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain(
      'Tool read_file was blocked by execution policy',
    );
    expect(lastFrame()).toContain('The requested action was NOT performed');
  });
});

describe('Chat with tool calls', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  it('shows tool approval when tool requires approval', async () => {
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
    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(true);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Tool requires approval');
  });

  it('auto-executes tool that does not require approval', async () => {
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
    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(false);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);

    await typeText(rerender, 'read file', chat);
    submitInput('read file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).toHaveBeenCalledWith(
      'read_file',
      {
        path: '/test.txt',
      },
      { allowedTools: undefined },
    );
  });

  it('handles tool result error', async () => {
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
    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(false);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'read file', chat);
    submitInput('read file');
    rerender(chat);
    await waitForStream();

    // The tool result message should contain the error
    expect(lastFrame()).toContain('File not found');
  });

  it('shows an error when tool execution throws after assistant content is committed', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Preparing tool call' };
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

    vi.mocked(tools.executeTool).mockRejectedValueOnce(
      new Error('Tool exploded'),
    );
    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(false);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'run tool', chat);
    submitInput('run tool');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Tool exploded');
  });

  it('blocks destructive tools in plan mode', async () => {
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

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Blocked. No changes were made.' };
    });

    const mockExecute = vi.fn().mockResolvedValue({
      content: '',
      error: 'Tool not allowed: write_file',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('The requested action was NOT performed');
    expect(lastFrame()).toContain(
      'Plan mode policy: write_file cannot be executed during planning',
    );
    expect(lastFrame()).toContain('Blocked. No changes were made.');
    expect(
      vi
        .mocked(streamChat)
        .mock.calls.some(([callMessages]) =>
          callMessages.some((message) =>
            message.content.includes(
              'Then display the execution plan as an unchecked Markdown checklist only',
            ),
          ),
        ),
    ).toBe(true);
  });

  it('reminds plan mode to display a checklist after a blocked write tool call', async () => {
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

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: '- [ ] write_file("src/test.ts", "content") - Update the file',
      };
    });

    const mockExecute = vi.fn();
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).not.toHaveBeenCalled();
    expect(lastFrame()).toContain(
      'Plan mode policy: write_file cannot be executed during planning',
    );
    expect(lastFrame()).toContain(
      'Then display the execution plan as an unchecked Markdown checklist only',
    );
    expect(lastFrame()).toContain(
      '- [ ] write_file("src/test.ts", "content") - Update the file',
    );
  });

  it('executes read-only tools during plan research before generating a plan', async () => {
    const { streamChat } = ollama;
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: '/notes.md' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'tool_calls', tool_calls: [] };
      yield {
        type: 'content',
        content: '- [ ] write_file("src/test.ts", "content") - Update the file',
      };
    });

    const mockExecute = vi.fn().mockResolvedValue({
      content: 'file contents',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'research the file', chat);
    submitInput('research the file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(mockExecute).toHaveBeenCalledWith(
      'read_file',
      { path: '/notes.md' },
      { allowedTools: tools.READ_TOOLS },
    );
    expect(lastFrame()).toContain('Tool read_file result:');
    expect(lastFrame()).toContain('Plan Generated');
  });

  it('shows an error when a read-only tool throws during plan research', async () => {
    const { streamChat } = ollama;
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Researching' };
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: '/notes.md' },
            },
          },
        ],
      };
    });

    vi.mocked(tools.executeTool).mockRejectedValueOnce(
      new Error('Read-only tool exploded'),
    );

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'research', chat);
    submitInput('research');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Read-only tool exploded');
  });

  it('shows plan execution approval and stays in plan mode when canceled', async () => {
    const { streamChat } = ollama;
    const onModeChange = vi.fn();

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: '- [ ] write_file("src/test.ts", "content") - Update the file',
      };
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'make a plan', chat);
    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Plan Generated');

    choosePlanMode(MODE.PLAN);
    await time.tick();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
    expect(lastFrame()).toContain(
      'Continuing in Plan mode. No tools were executed.',
    );

    choosePlanMode(MODE.AUTO);
    await time.tick();
  });

  it('executes an approved plan immediately in auto mode', async () => {
    const { streamChat } = ollama;
    const onModeChange = vi.fn();

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: '- [ ] write_file("src/test.ts", "content") - Update the file',
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Executed automatically.' };
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'execute automatically', chat);
    submitInput('execute automatically');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.AUTO);
    expect(
      vi
        .mocked(streamChat)
        .mock.calls.some(([messages]) =>
          messages.some((message) =>
            message.content.includes(
              'Execute the plan above. Use tools as needed without asking for further confirmation.',
            ),
          ),
        ),
    ).toBe(true);
    expect(lastFrame()).toContain('Executed automatically.');
  });

  it('executes an approved plan in safe mode with approval instructions', async () => {
    const { streamChat } = ollama;
    const onModeChange = vi.fn();

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: '- [ ] write_file("src/test.ts", "content") - Update the file',
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Waiting safely.' };
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);

    await typeText(rerender, 'execute safely', chat);
    submitInput('execute safely');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    choosePlanMode(MODE.SAFE);
    await waitForStream();

    expect(onModeChange).toHaveBeenCalledWith(MODE.SAFE);
    expect(
      vi
        .mocked(streamChat)
        .mock.calls.some(([messages]) =>
          messages.some((message) =>
            message.content.includes(
              'Execute the plan above one step at a time. Wait for user approval before each tool call that modifies files or runs commands.',
            ),
          ),
        ),
    ).toBe(true);
  });

  it('handles tool approval rejection', async () => {
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

    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(true);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // Verify approval prompt is shown
    expect(lastFrame()).toContain('Tool requires approval');

    chooseToolDecision(DECISION.REJECT);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).not.toContain('Tool requires approval');
    expect(lastFrame()).toContain('❗ Tool call rejected.');
    expect(lastFrame()).toContain('>');
    expect(vi.mocked(ollama.streamChat)).toHaveBeenCalledOnce();
  });

  it('handles tool approval acceptance', async () => {
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

    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(true);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // Verify approval prompt is shown
    expect(lastFrame()).toContain('Tool requires approval');

    chooseToolDecision(DECISION.APPROVE);
    await waitForStream();
    rerender(chat);

    // Should have called executeTool
    expect(mockExecute).toHaveBeenCalledWith('write_file', {
      path: '/test.txt',
      content: 'hello',
    });
  });

  it('handles tool result with error in approval flow', async () => {
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

    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(true);

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { rerender } = render(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    chooseToolDecision(DECISION.APPROVE);
    await waitForStream();
    rerender(chat);

    // Should have called executeTool
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('Chat with error', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  it('shows error message when stream fails with Error', async () => {
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
      throw new Error('Connection failed');
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Connection failed');
  });

  it('shows error message when plan-mode research fails with Error', async () => {
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
      throw new Error('Research failed');
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'research', chat);
    submitInput('research');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Research failed');
  });

  it('shows error message when plan generation fails', async () => {
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research complete.' };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
      throw new Error('Plan generation crashed');
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'plan', chat);
    submitInput('plan');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Plan generation crashed');
  });
});

describe('Chat interrupt', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  it('shows interrupt notice and turn_aborted message when interrupted during streaming', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      yield { type: 'content', content: 'Partial' };
      await new Promise<never>(() => undefined);
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);
    submitInput('hello');
    rerender(chat);
    await time.tick();

    fireInterrupt();
    rerender(chat);
    await time.tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('❗ Execution interrupted');
    expect(frame).not.toContain('turn_aborted');
    expect(frame).toContain('>');
  });

  it('clears interrupt notice on next submit', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      yield { type: 'content', content: 'Partial' };
      await new Promise<never>(() => undefined);
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = render(chat);
    submitInput('hello');
    rerender(chat);
    await time.tick();

    fireInterrupt();
    rerender(chat);
    await time.tick();
    expect(lastFrame()).toContain('❗ Execution interrupted');

    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'New response' };
    });
    submitInput('continue');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).not.toContain('❗ Execution interrupted');
  });
});
