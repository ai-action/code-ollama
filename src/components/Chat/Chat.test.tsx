import { Text } from 'ink';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { DECISION, MODE, PROMPT, THEME } from '@/constants';
import type { Decision, ToolName, ToolResult } from '@/types';
import { ollama, time, tools } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

const mockState = vi.hoisted(() => ({
  handler: undefined as
    | ((value: { content: string; images?: string[] }) => void)
    | undefined,
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

const toolSets = vi.hoisted(() => ({
  READ_TOOLS: new Set<string>(),
  WRITE_TOOLS: new Set<string>(),
}));

const toolMocks = vi.hoisted(() => ({
  executeTool: vi.fn(),
}));
const clearScreen = vi.hoisted(() => vi.fn());

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
      const isPlanReview = options.some(({ value }) =>
        [MODE.SAFE, MODE.AUTO, MODE.PLAN].includes(value),
      );

      if (isPlanReview) {
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

vi.mock('@/components/CodeBlock', async () => ({
  ...(await vi.importActual('@/components/CodeBlock')),
  prewarmCodeBlocks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  ollama: {
    streamChat: vi.fn().mockImplementation(function* () {
      yield { type: 'content', content: 'Mocked' };
      yield { type: 'content', content: ' response' };
    }),
    sanitizeAssistantContent: vi.fn((content: string) => content),
    hasUncalledToolIntent: vi.fn(() => false),
    TOOL_INTENT_CORRECTION: 'Please call the appropriate tool now.',
  },
  screen: {
    clear: clearScreen,
  },
  tools: {
    TOOLS: [],
    READ_TOOLS: toolSets.READ_TOOLS,
    WRITE_TOOLS: toolSets.WRITE_TOOLS,
    executeTool: toolMocks.executeTool,
    executeToolCall: vi.fn(
      async (toolCall: {
        function: { name: string; arguments: Record<string, unknown> };
      }) => {
        const result = (await toolMocks.executeTool(
          toolCall.function.name,
          toolCall.function.arguments,
        )) as ToolResult;
        return result;
      },
    ),
    formatToolResultContent: vi.fn(
      (toolName: string, result: ToolResult) =>
        `Tool ${toolName} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}${result.stack ? `\nStack trace:\n${result.stack}` : ''}`,
    ),
    normalizeToolCall: vi.fn(
      (toolCall: {
        function: { name: string; arguments: Record<string, unknown> };
      }) => ({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        requiresApproval: toolSets.WRITE_TOOLS.has(toolCall.function.name),
      }),
    ),
  },
}));

vi.mock('./ChatInput', () => ({
  ChatInput: (props: {
    history?: string[];
    onSubmit?: (value: { content: string; images?: string[] }) => void;
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

function submitInput(value: string, images?: string[]) {
  mockState.handler?.({ content: value, images });
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
  clearScreen.mockClear();
  planApprovalState.clear();
  toolApprovalState.clear();
  interruptState.clear();
  tools.TOOLS.splice(0, tools.TOOLS.length);
  tools.READ_TOOLS.clear();
  tools.WRITE_TOOLS.clear();
  vi.mocked(ollama.streamChat).mockImplementation(async function* () {
    await Promise.resolve();
    yield { type: 'content', content: 'Mocked' };
    yield { type: 'content', content: ' response' };
  });
  vi.mocked(ollama.sanitizeAssistantContent).mockImplementation(
    (content: string) => content,
  );
  vi.mocked(ollama.hasUncalledToolIntent).mockReturnValue(false);
  vi.mocked(tools.executeTool).mockReset();
  vi.mocked(tools.executeToolCall).mockImplementation((toolCall) =>
    tools.executeTool(
      toolCall.function.name as ToolName,
      toolCall.function.arguments,
    ),
  );
  vi.mocked(tools.formatToolResultContent).mockImplementation(
    (toolName: string, result: ToolResult) =>
      `Tool ${toolName} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}${result.stack ? `\nStack trace:\n${result.stack}` : ''}`,
  );
  vi.mocked(tools.normalizeToolCall).mockImplementation((toolCall) => ({
    name: toolCall.function.name as ToolName,
    arguments: toolCall.function.arguments,
    requiresApproval: tools.WRITE_TOOLS.has(toolCall.function.name),
  }));
}

describe('Chat', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  const onModeChange = vi.fn();

  it('renders input prompt without system message', async () => {
    const { lastFrame } = renderWithTheme(
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
    const { lastFrame, rerender } = renderWithTheme(chat);
    await time.tick();
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('hello');
  }, 10_000);

  it('derives prompt history from user messages and excludes slash commands', async () => {
    renderWithTheme(
      <Chat
        initialMessages={[
          { role: 'user', content: 'first prompt' },
          { role: 'assistant', content: 'response' },
          { role: 'user', content: '/models' },
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
    const { lastFrame, rerender } = renderWithTheme(chat);
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
    const { lastFrame, rerender } = renderWithTheme(chat);
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
    const { rerender } = renderWithTheme(chat);
    await time.tick();
    submitInput('show me code');
    rerender(chat);
    await waitForStream();
    expect(vi.mocked(prewarmCodeBlocks)).toHaveBeenCalledWith(
      'Here:\n```ts\nconst x = 1;\n```',
      THEME.getTheme(),
    );
  }, 10_000);

  it('formats complete markdown while the assistant is still streaming', async () => {
    let resumeStream: (() => void) | undefined;

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      yield { type: 'content', content: 'Use **important**' };
      await new Promise<void>((resolve) => {
        resumeStream = resolve;
      });
      yield { type: 'content', content: ' text' };
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
    const { lastFrame, rerender } = renderWithTheme(chat);
    await time.tick();
    submitInput('format this');
    rerender(chat);
    await time.tick();

    const streamingFrame = lastFrame() ?? '';
    expect(streamingFrame).toContain('Use important');
    expect(streamingFrame).not.toContain('**important**');

    resumeStream?.();
    await waitForStream();
    expect(lastFrame()).toContain('Use important text');
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
    const { rerender } = renderWithTheme(chat);
    submitInput('/models');
    rerender(chat);
    await time.tick();
    expect(onCommand).toHaveBeenCalledWith('/models');
  });

  it('compacts the conversation and replaces messages', async () => {
    const onCommand = vi.fn();
    const onMessagesReplace = vi.fn();
    const initialMessages = [
      { role: 'user', content: 'older prompt' },
      { role: 'assistant', content: 'older reply with tool output' },
      { role: 'user', content: 'latest prompt' },
      { role: 'assistant', content: 'latest reply' },
    ] as const;
    const chat = (
      <Chat
        initialMessages={[...initialMessages]}
        model="gemma4"
        onCommand={onCommand}
        onMessagesReplace={onMessagesReplace}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { rerender } = renderWithTheme(chat);
    await time.tick();
    submitInput('/compact');
    rerender(chat);
    await waitForStream();

    expect(onCommand).not.toHaveBeenCalled();
    expect(ollama.streamChat).toHaveBeenCalledWith(
      [
        ...initialMessages,
        {
          role: 'user',
          content: PROMPT.COMPACT_MESSAGES_INSTRUCTION,
        },
      ],
      'gemma4',
      [],
      expect.any(AbortSignal),
    );
    expect(onMessagesReplace).toHaveBeenCalledWith([
      {
        role: 'system',
        content: 'Compacted conversation context:\n\nMocked response',
      },
      { role: 'user', content: 'latest prompt' },
      { role: 'assistant', content: 'latest reply' },
    ]);
    expect(clearScreen).toHaveBeenCalledWith('0');
    expect(prewarmCodeBlocks).toHaveBeenCalledWith(
      'Mocked response',
      THEME.getTheme(),
    );
  });

  it('shows a loading spinner while compacting', async () => {
    let resumeStream: (() => void) | undefined;
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await new Promise<void>((resolve) => {
        resumeStream = resolve;
      });
      yield { type: 'content', content: 'Compacted summary' };
    });
    const chat = (
      <Chat
        initialMessages={[{ role: 'user', content: 'summarize me' }]}
        model="gemma4"
        onCommand={vi.fn()}
        onMessagesReplace={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('/compact');
    rerender(chat);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Thinking');
    });

    resumeStream?.();
    await waitForStream();
  });

  it('shows an error and leaves messages unchanged when compaction fails', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      if (Date.now() < 0) {
        yield { type: 'content', content: '' };
      }
      throw new Error('model unavailable');
    });
    const onMessagesReplace = vi.fn();
    const chat = (
      <Chat
        initialMessages={[{ role: 'user', content: 'keep me' }]}
        model="gemma4"
        onCommand={vi.fn()}
        onMessagesReplace={onMessagesReplace}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('/compact');
    rerender(chat);
    await waitForStream();

    expect(onMessagesReplace).not.toHaveBeenCalled();
    expect(clearScreen).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Compaction failed: model unavailable');
    expect(lastFrame()).toContain('keep me');
  });

  it('shows an error when compacting with no messages', async () => {
    const onMessagesReplace = vi.fn();
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        onMessagesReplace={onMessagesReplace}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { lastFrame, rerender } = renderWithTheme(chat);
    await time.tick();

    submitInput('/compact');
    rerender(chat);
    await time.tick();

    expect(onMessagesReplace).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Nothing to compact yet');
  });

  it('shows an error when compaction returns empty summary', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '   ' };
    });
    const onMessagesReplace = vi.fn();
    const chat = (
      <Chat
        initialMessages={[{ role: 'user', content: 'test' }]}
        model="gemma4"
        onCommand={vi.fn()}
        onMessagesReplace={onMessagesReplace}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('/compact');
    rerender(chat);
    await waitForStream();

    expect(onMessagesReplace).not.toHaveBeenCalled();
    expect(lastFrame()).toContain(
      'Compaction failed: Compaction summary was empty',
    );
  });

  it('compacts conversation keeping only user message when no assistant reply exists', async () => {
    const onMessagesReplace = vi.fn();
    const chat = (
      <Chat
        initialMessages={[{ role: 'user', content: 'only user message' }]}
        model="gemma4"
        onCommand={vi.fn()}
        onMessagesReplace={onMessagesReplace}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );

    const { rerender } = renderWithTheme(chat);
    await time.tick();
    submitInput('/compact');
    rerender(chat);
    await waitForStream();

    expect(onMessagesReplace).toHaveBeenCalledWith([
      {
        role: 'system',
        content: 'Compacted conversation context:\n\nMocked response',
      },
      { role: 'user', content: 'only user message' },
    ]);
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

    const { lastFrame, rerender } = renderWithTheme(renderChat('0'));
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
    const { rerender } = renderWithTheme(chat);
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'read blocked file', chat);
    submitInput('read blocked file');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain(
      'Tool read_file was blocked by execution policy',
    );
    expect(lastFrame()).toContain(
      'The requested action did not complete successfully',
    );
  });
});

describe('Chat with tool calls', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  it('skips tool_calls chunk with empty array and continues streaming', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'tool_calls', tool_calls: [] };
      yield { type: 'content', content: 'After empty tool_calls' };
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('After empty tool_calls');
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    const { rerender } = renderWithTheme(chat);

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

  it('continues auto mode after executing multiple tool calls in one chunk', async () => {
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
          {
            function: {
              name: 'run_shell',
              arguments: { command: 'npm test' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'All tools completed.' };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });
    tools.WRITE_TOOLS.add('run_shell');

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.AUTO}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'do the work', chat);
    submitInput('do the work');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).toHaveBeenCalledTimes(2);
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('All tools completed.');
  });

  it('retries with correction message when tool intent is detected but no tool was called', async () => {
    const { streamChat } = ollama;

    vi.mocked(ollama.hasUncalledToolIntent)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'I will read the file.' };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'File contents retrieved.' };
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('read a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('File contents retrieved.');
    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      | ollama.Message[]
      | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content === 'Please call the appropriate tool now.',
      ),
    ).toBe(true);
  });

  it('continues after malformed tool calls without executing them', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'writeFile',
              arguments: { path: '/test.txt', content: 'hello' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Malformed call handled.' };
    });

    vi.mocked(tools.normalizeToolCall).mockImplementationOnce(() => {
      throw new Error('Unknown tool: writeFile');
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.AUTO}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Malformed call handled.');
    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      | ollama.Message[]
      | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content.includes('Unknown tool: writeFile'),
      ),
    ).toBe(true);
  });

  it('includes diff in tool result message when tool returns a diff', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: { path: '/test.ts', oldText: 'old', newText: 'new' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done.' };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({
      content: 'File edited successfully',
      diff: {
        path: '/test.ts',
        visible: '--- /test.ts\n+++ /test.ts\n-old\n+new',
        truncated: false,
        totalLines: 4,
        visibleLines: 4,
      },
    });
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
    const { rerender } = renderWithTheme(chat);

    submitInput('edit the file');
    rerender(chat);
    await waitForStream();

    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      | ollama.Message[]
      | undefined;
    expect(
      secondCallMessages?.some(
        (message) => message.toolResult?.diff !== undefined,
      ),
    ).toBe(true);
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).not.toHaveBeenCalled();
    expect(lastFrame()).toContain(
      'The requested action did not complete successfully',
    );
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
              'Then display the plan using either the Plan Needs Input or Proposed Plan Markdown template',
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
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- write_file("src/test.ts") - Update the file',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();

    expect(mockExecute).not.toHaveBeenCalled();
    expect(lastFrame()).toContain(
      'Plan mode policy: write_file cannot be executed during planning',
    );
    expect(lastFrame()).toContain(
      'Then display the plan using either the Plan Needs Input or Proposed Plan Markdown template',
    );
    expect(lastFrame()).toContain('write_file("src/test.ts")');
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
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- write_file("src/test.ts") - Update the file',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'research', chat);
    submitInput('research');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Read-only tool exploded');
  });

  it('does not regenerate plan output when research returns Plan Needs Input', async () => {
    const { streamChat } = ollama;
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'grep_search',
        description: 'Search files',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'grep_search',
    );

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'grep_search',
              arguments: { path: 'src', pattern: 'MAX_TOOL_TURNS' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          '## Plan Needs Input\n\n### Questions\n- Which location should change?\n\n### What I Found\n- Two matches.\n\n### Draft Plan\n- Wait for scope.\n\n## Proposed Plan\n\n### Execution Steps\n\n- edit_file("src/cli.ts") - Update the value',
      };
    });

    const mockExecute = vi.fn().mockResolvedValue({
      content: 'src/components/Chat/Chat.tsx:35:const MAX_TOOL_TURNS = 25;',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'where to change MAX_TOOL_TURNS?', chat);
    submitInput('where to change MAX_TOOL_TURNS?');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('## Plan Needs Input');
    expect(lastFrame()).toContain('Which location should change?');
    expect(lastFrame()).not.toContain('Plan Review - Choose next step:');
  });

  it('does not regenerate plan output when research answers directly', async () => {
    const { streamChat } = ollama;
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'grep_search',
        description: 'Search files',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'grep_search',
    );

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'grep_search',
              arguments: { path: 'src', pattern: 'MAX_TOOL_TURNS' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'The constant `MAX_TOOL_TURNS` is defined in `src/cli.ts` and `src/components/Chat/Chat.tsx`.',
      };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({
      content:
        'src/cli.ts:11:const MAX_TOOL_TURNS = 25;\nsrc/components/Chat/Chat.tsx:35:const MAX_TOOL_TURNS = 25;',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('where can I change MAX_TOOL_TURNS?');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('src/cli.ts');
    expect(lastFrame()).toContain('src/components/Chat/Chat.tsx');
    expect(lastFrame()).not.toContain('Plan Review - Choose next step:');
  });

  it('retries plan research when tool intent is detected but no tool was called', async () => {
    const { streamChat } = ollama;
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'grep_search',
        description: 'Search files',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'grep_search',
    );
    vi.mocked(ollama.hasUncalledToolIntent)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'I will search the codebase for MAX_TOOL_TURNS.',
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'grep_search',
              arguments: { path: 'src', pattern: 'MAX_TOOL_TURNS' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          '## Plan Needs Input\n\n### Questions\n- Which location should change?',
      };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({
      content: 'src/cli.ts:11:const MAX_TOOL_TURNS = 25;',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('where can I adjust MAX_TOOL_TURNS?');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    expect(streamChat).toHaveBeenCalledTimes(3);
    expect(tools.executeTool).toHaveBeenCalledWith(
      'grep_search',
      { path: 'src', pattern: 'MAX_TOOL_TURNS' },
      { allowedTools: tools.READ_TOOLS },
    );
    expect(lastFrame()).toContain('Which location should change?');
    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      | ollama.Message[]
      | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content === 'Please call the appropriate tool now.',
      ),
    ).toBe(true);
  });

  it('stops loading when research returns non-executable Proposed Plan', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: '## Proposed Plan\n\n### Summary\n\nNo changes needed.',
      };
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'check if changes needed', chat);
    submitInput('check if changes needed');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    // Should show the plan content but not the plan review (no executable steps)
    expect(lastFrame()).toContain('## Proposed Plan');
    expect(lastFrame()).toContain('No changes needed');
    expect(lastFrame()).not.toContain('Plan Review - Choose next step:');
    // Should only call streamChat once (early return after isPlanModeFinalResponse)
    expect(streamChat).toHaveBeenCalledTimes(1);
  });

  it('detects executable plan during research phase and shows plan review immediately', async () => {
    const { streamChat } = ollama;
    vi.mocked(ollama.hasUncalledToolIntent).mockReturnValue(true);

    // First call returns an executable plan directly (no tool calls needed)
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- read_file("/test.txt") - Read the file',
      };
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'plan with executable steps', chat);
    submitInput('plan with executable steps');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    // Should show PlanReview when hasExecutablePlan returns true
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
    expect(lastFrame()).toContain('read_file("/test.txt")');
    // Should have called streamChat only once (early return after detecting executable plan)
    expect(streamChat).toHaveBeenCalledTimes(1);
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
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- write_file("src/test.ts") - Update the file',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'make a plan', chat);
    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    await time.tick(50);
    rerender(chat);

    expect(lastFrame()).toContain('Plan Review - Choose next step:');

    choosePlanMode(MODE.PLAN);
    await time.tick();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
    expect(lastFrame()).toContain(
      'Continuing in Plan mode. No tools were executed.',
    );

    choosePlanMode(MODE.AUTO);
    await time.tick();
  }, 20_000);

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
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- write_file("src/test.ts") - Update the file',
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
        content:
          '## Proposed Plan\n\n### Execution Steps\n\n- write_file("src/test.ts") - Update the file',
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
    const { rerender } = renderWithTheme(chat);

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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    expect(lastFrame()).toContain('Tool call rejected.');
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    expect(streamChat).toHaveBeenCalledTimes(2);
    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      | ollama.Message[]
      | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content.includes('File written successfully'),
      ),
    ).toBe(true);
  });

  it('continues approved tool flow with current mode after mode changes', async () => {
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
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'write_file',
              arguments: { path: '/next.txt', content: 'next' },
            },
          },
        ],
      };
    });

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done' };
    });

    vi.mocked(tools.executeTool).mockResolvedValue({
      content: 'File written successfully',
    });

    vi.spyOn(tools.WRITE_TOOLS, 'has').mockReturnValue(true);

    const safeChat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const autoChat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.AUTO}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );

    const { lastFrame, rerender } = renderWithTheme(safeChat);

    await typeText(rerender, 'write a file', safeChat);
    submitInput('write a file');
    rerender(safeChat);
    await waitForStream();
    rerender(safeChat);

    expect(lastFrame()).toContain('Tool requires approval');

    rerender(autoChat);
    chooseToolDecision(DECISION.APPROVE);
    await waitForStream();
    rerender(autoChat);

    expect(lastFrame()).not.toContain('Tool requires approval');
    expect(tools.executeTool).toHaveBeenCalledTimes(2);
    expect(tools.executeTool).toHaveBeenLastCalledWith(
      'write_file',
      { path: '/next.txt', content: 'next' },
      { allowedTools: undefined },
    );
    expect(streamChat).toHaveBeenCalledTimes(3);
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
      stack: 'Error: Permission denied\n    at writeFile',
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
    const { rerender } = renderWithTheme(chat);

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    chooseToolDecision(DECISION.APPROVE);
    await vi.waitFor(() => {
      expect(streamChat).toHaveBeenCalledTimes(2);
    });
    rerender(chat);

    // Should have called executeTool
    expect(mockExecute).toHaveBeenCalled();
    const streamMessageBatches = vi
      .mocked(streamChat)
      .mock.calls.map(([messages]) => messages);
    expect(
      streamMessageBatches.some((messages) =>
        messages.some(
          (message) =>
            message.role === 'system' &&
            message.content.includes(
              'Stack trace:\nError: Permission denied',
            ) &&
            message.content.includes('at writeFile'),
        ),
      ),
    ).toBe(true);
  });

  it('shows thinking spinner while an approved tool call is running', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'run_shell',
              arguments: { command: 'npm test' },
            },
          },
        ],
      };
    });

    let resolveTool: ((value: { content: string }) => void) | undefined;
    const toolPromise = new Promise<{ content: string }>((resolve) => {
      resolveTool = resolve;
    });
    const mockExecute = vi.fn(() => toolPromise);
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'run tests', chat);
    submitInput('run tests');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    chooseToolDecision(DECISION.APPROVE);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Thinking');
    });

    resolveTool?.({ content: 'done' });
    await waitForStream();
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'research', chat);
    submitInput('research');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Research failed');
  });

  it('handles empty assistant content during plan research phase', async () => {
    const { streamChat, sanitizeAssistantContent } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Research' };
    });
    vi.mocked(sanitizeAssistantContent).mockReturnValueOnce('');

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'tool_calls', tool_calls: [] };
      yield {
        type: 'content',
        content: '## Proposed Plan',
      };
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
    const { lastFrame, rerender } = renderWithTheme(chat);

    await typeText(rerender, 'research', chat);
    submitInput('research');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    // The empty research response should not add an empty assistant message
    // and should proceed to plan generation
    expect(lastFrame()).toContain('## Proposed Plan');
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
    const { lastFrame, rerender } = renderWithTheme(chat);

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
    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('hello');
    rerender(chat);
    await time.tick();

    fireInterrupt();
    rerender(chat);
    await time.tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Execution interrupted');
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
    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('hello');
    rerender(chat);
    await time.tick();

    fireInterrupt();
    rerender(chat);
    await time.tick();
    expect(lastFrame()).toContain('Execution interrupted');

    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'New response' };
    });
    submitInput('continue');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).not.toContain('Execution interrupted');
  });

  it('submits with empty images array without adding images property', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('hello', []);
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Mocked response');
  });

  it('submits without images parameter', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);
    // Call submitInput without the images parameter (undefined)
    mockState.handler?.({ content: 'hello' });
    mockState.clear();
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Mocked response');
  });

  it('submits with images array containing items', async () => {
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('hello', ['/tmp/image.png']);
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Mocked response');
  });
});
