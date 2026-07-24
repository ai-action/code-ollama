import { Text } from 'ink';
import { useEffect, useRef } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { DECISION, MODE, PROMPT, ROLE, THEME } from '@/constants';
import type { Decision, ToolResult } from '@/types';
import { ollama, time, tools } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

const mockState = vi.hoisted(() => ({
  handler: undefined as
    ((value: { content: string; images?: string[] }) => void) | undefined,
  history: [] as string[],
  isActive: false,
  restoreQueuedMessage: undefined as (() => string | undefined) | undefined,
  testInput: '',
  shouldReset: false,
  clear() {
    this.handler = undefined;
    this.history = [];
    this.isActive = false;
    this.restoreQueuedMessage = undefined;
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

const planQuestionState = vi.hoisted(() => ({
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
  TOOLS: [] as {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[],
  READ_TOOLS: new Set<string>(),
  WRITE_TOOLS: new Set<string>(),
}));

const toolMocks = vi.hoisted(() => ({
  executeTool: vi.fn(),
  normalizeToolCall: vi.fn(
    (toolCall: {
      function: { name: string; arguments: Record<string, unknown> };
    }) => ({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
      requiresApproval: toolSets.WRITE_TOOLS.has(toolCall.function.name),
    }),
  ),
  runShell: vi.fn(),
  specializeFinishPlanModeParameters: vi.fn(
    (parameters: Record<string, unknown>, outcome: string) => {
      const properties = parameters.properties as Record<
        string,
        Record<string, unknown>
      >;
      const limits =
        outcome === 'answer'
          ? {
              tasks: { maxItems: 0 },
              tests: { maxItems: 0 },
              assumptions: { maxItems: 0 },
              questions: { maxItems: 0 },
            }
          : outcome === 'ready'
            ? {
                tasks: { minItems: 1 },
                tests: { minItems: 1 },
                questions: { maxItems: 0 },
              }
            : { questions: { minItems: 1, maxItems: 1 } };

      return {
        ...parameters,
        properties: {
          ...properties,
          outcome: { ...properties.outcome, enum: [outcome] },
          ...Object.fromEntries(
            Object.entries(limits).map(([name, bounds]) => [
              name,
              { ...properties[name], ...bounds },
            ]),
          ),
        },
      };
    },
  ),
}));
const agentMocks = vi.hoisted(() => ({
  withSystemMessage: vi.fn((messages: unknown[]) => messages),
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
      } else if (
        options.some(({ label }) => label === 'Type a custom response')
      ) {
        planQuestionState.onChange = onChange;
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
  agents: {
    withSystemMessage: agentMocks.withSystemMessage,
  },
  ollama: {
    generateStructuredChat: vi
      .fn()
      .mockRejectedValue(new Error('Structured plan unavailable')),
    streamChat: vi.fn().mockImplementation(function* () {
      yield { type: 'content', content: 'Mocked' };
      yield { type: 'content', content: ' response' };
    }),
    sanitizeAssistantContent: vi.fn((content: string) => content),
    hasSerializedToolCall: vi.fn(() => false),
    hasUncalledToolIntent: vi.fn(() => false),
    TOOL_INTENT_CORRECTION: 'Please call the appropriate tool now.',
  },
  screen: {
    clear: clearScreen,
  },
  tools: {
    TOOLS: toolSets.TOOLS,
    getToolDefinitions: vi.fn(() => Promise.resolve(toolSets.TOOLS)),
    READ_TOOLS: toolSets.READ_TOOLS,
    WRITE_TOOLS: toolSets.WRITE_TOOLS,
    executeTool: toolMocks.executeTool,
    executeToolCalls: vi.fn(
      async (
        toolCalls: {
          function: { name: string; arguments: Record<string, unknown> };
        }[],
        options?: {
          allowedTools?: Set<string>;
          mode?: string;
          onProgress?: (progress: {
            index: number;
            name: string;
            status: 'running' | 'completed' | 'failed';
          }) => void;
        },
      ) =>
        Promise.all(
          toolCalls.map(async (toolCall, index) => {
            const name = toolCall.function.name;
            options?.onProgress?.({ index, name, status: 'running' });
            let normalized;
            try {
              normalized = toolMocks.normalizeToolCall(toolCall);
            } catch (error) {
              options?.onProgress?.({ index, name, status: 'failed' });
              return {
                toolCall,
                result: {
                  content: '',
                  error: error instanceof Error ? error.message : String(error),
                },
              };
            }
            const args = normalized.arguments;
            const result = (await toolMocks.executeTool(normalized.name, args, {
              allowedTools: options?.allowedTools,
              mode: options?.mode,
            })) as ToolResult;
            options?.onProgress?.({
              index,
              name,
              status: result.error ? 'failed' : 'completed',
            });
            return { toolCall, result };
          }),
        ),
    ),
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
    isMcpToolAllowedInMode: vi.fn(() => false),
    runShell: toolMocks.runShell,
    normalizeToolCall: toolMocks.normalizeToolCall,
    specializeFinishPlanModeParameters:
      toolMocks.specializeFinishPlanModeParameters,
  },
}));

vi.mock('./ChatInput', () => ({
  ChatInput: (props: {
    history?: string[];
    onSubmit?: (value: { content: string; images?: string[] }) => void;
    onInterrupt?: () => void;
    onRestoreQueuedMessage?: () => string | undefined;
    isActive?: boolean;
    isDisabled?: boolean;
  }) => {
    if (props.onSubmit) {
      mockState.handler = props.onSubmit;
    }

    mockState.history = props.history ?? [];
    mockState.isActive = props.isActive ?? false;
    mockState.restoreQueuedMessage = props.onRestoreQueuedMessage;

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
import { useRunTurn } from './hooks';

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

function choosePlanQuestion(value: string) {
  planQuestionState.onChange?.(value);
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

function planArguments(outcome: 'ready' | 'needs_input' | 'answer' = 'ready') {
  return {
    outcome,
    title: outcome === 'answer' ? 'Answer' : 'Update plan mode',
    summary:
      outcome === 'answer'
        ? 'No implementation is needed.'
        : 'Use structured plan submission.',
    tasks:
      outcome === 'answer'
        ? []
        : [
            {
              action: 'change',
              id: 'task-1',
              description: 'Update the file',
              dependencies: [],
              targets: ['src/constants/prompt.ts'],
              verification: 'The tests pass',
            },
          ],
    tests: outcome === 'ready' ? ['npm test'] : [],
    assumptions: [],
    questions:
      outcome === 'needs_input' ? ['Which location should change?'] : [],
  };
}

function finishPlanModeChunk(
  outcome: 'ready' | 'needs_input' | 'answer' = 'ready',
) {
  return {
    type: 'tool_calls' as const,
    tool_calls: [
      {
        function: {
          name: 'finish_plan_mode',
          arguments:
            outcome === 'answer'
              ? {
                  outcome,
                  title: 'Answer',
                  summary: 'No implementation is needed.',
                }
              : planArguments(outcome),
        },
      },
    ],
  };
}

function resetChatMocks() {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mockState.clear();
  clearScreen.mockClear();
  planApprovalState.clear();
  planQuestionState.clear();
  toolApprovalState.clear();
  interruptState.clear();
  tools.TOOLS.splice(0, tools.TOOLS.length);
  tools.READ_TOOLS.clear();
  tools.WRITE_TOOLS.clear();
  vi.mocked(ollama.streamChat)
    .mockReset()
    .mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Mocked' };
      yield { type: 'content', content: ' response' };
    });
  vi.mocked(ollama.sanitizeAssistantContent).mockImplementation(
    (content: string) => content,
  );
  vi.mocked(ollama.generateStructuredChat)
    .mockReset()
    .mockRejectedValue(new Error('Structured plan unavailable'));
  vi.mocked(ollama.hasSerializedToolCall).mockReturnValue(false);
  vi.mocked(ollama.hasUncalledToolIntent).mockReturnValue(false);
  vi.mocked(tools.executeTool).mockReset();
  toolMocks.normalizeToolCall.mockReset();
  toolMocks.normalizeToolCall.mockImplementation((toolCall) => ({
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
    requiresApproval: toolSets.WRITE_TOOLS.has(toolCall.function.name),
  }));
  vi.mocked(tools.runShell).mockReset();
  agentMocks.withSystemMessage.mockImplementation(
    (messages: unknown[]) => messages,
  );
  vi.mocked(tools.executeToolCall).mockImplementation((toolCall) =>
    tools.executeTool(toolCall.function.name, toolCall.function.arguments),
  );
  vi.mocked(tools.formatToolResultContent).mockImplementation(
    (toolName: string, result: ToolResult) =>
      `Tool ${toolName} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}${result.stack ? `\nStack trace:\n${result.stack}` : ''}`,
  );
  vi.mocked(tools.normalizeToolCall).mockImplementation((toolCall) => ({
    name: toolCall.function.name,
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
  });

  it('notifies onMessagesChange when messages change', async () => {
    const onMessagesChange = vi.fn();
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
        onMessagesChange={onMessagesChange}
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);
    await time.tick();
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    expect(lastFrame()).toContain('hello');
    expect(onMessagesChange).toHaveBeenCalled();
  });

  it('returns undefined from restoreQueuedMessage when queue is empty', async () => {
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
    rerender(chat);
    await time.tick();

    expect(mockState.restoreQueuedMessage?.()).toBeUndefined();
  });

  it('shows queued messages and restores the latest message for editing', async () => {
    let releaseStream: (() => void) | undefined;
    let streamIndex = 0;
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      streamIndex += 1;
      if (streamIndex === 1) {
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
      }
      yield { type: 'content', content: 'Done' };
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

    mockState.handler?.({ content: 'first' });
    rerender(chat);
    await time.tick();
    mockState.handler?.({ content: 'second' });
    mockState.handler?.({ content: 'third' });
    rerender(chat);
    await time.tick();

    expect(lastFrame()).toContain('Queued messages:');
    expect(lastFrame()).toContain('second');
    expect(lastFrame()).toContain('third');
    expect(mockState.restoreQueuedMessage?.()).toBe('third');
    rerender(chat);
    await time.tick();
    expect(lastFrame()).not.toContain('  ↳ third');

    releaseStream?.();
    await vi.waitFor(() => {
      rerender(chat);
      expect(ollama.streamChat).toHaveBeenCalledTimes(2);
      expect(lastFrame()).not.toContain('Queued messages:');
    });
  });

  it('does not queue a message with images submitted while a turn is active', async () => {
    let releaseStream: (() => void) | undefined;
    let streamIndex = 0;
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      streamIndex += 1;
      if (streamIndex === 1) {
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
      }
      yield { type: 'content', content: 'Done' };
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

    mockState.handler?.({ content: 'first' });
    rerender(chat);
    await time.tick();

    mockState.handler?.({ content: 'with image', images: ['/tmp/img.png'] });
    rerender(chat);
    await time.tick();

    expect(lastFrame()).not.toContain('Queued messages:');

    releaseStream?.();
    await vi.waitFor(() => {
      rerender(chat);
      expect(ollama.streamChat).toHaveBeenCalledTimes(1);
      expect(lastFrame()).not.toContain('Thinking');
    });
  });

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
  });

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
  });

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
  });

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

  it('shows session stats without forwarding the command', async () => {
    const onCommand = vi.fn();
    const chat = (
      <Chat
        model="gemma4"
        onCommand={onCommand}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
        stats={{
          modelCalls: 1,
          promptTokens: 100,
          outputTokens: 20,
          totalDurationNs: 5_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 900_000_000,
          evalDurationNs: 3_500_000_000,
          models: {
            gemma4: {
              calls: 1,
              promptTokens: 100,
              outputTokens: 20,
              totalDurationNs: 5_000_000_000,
              loadDurationNs: 100_000_000,
              promptEvalDurationNs: 900_000_000,
              evalDurationNs: 3_500_000_000,
            },
          },
          lastCall: {
            model: 'gemma4',
            promptTokens: 100,
            outputTokens: 20,
            totalDurationNs: 5_000_000_000,
            loadDurationNs: 100_000_000,
            promptEvalDurationNs: 900_000_000,
            evalDurationNs: 3_500_000_000,
          },
        }}
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('/stats');
    rerender(chat);
    await time.tick();

    expect(lastFrame()).toContain('Session Stats');
    expect(lastFrame()).toContain('Last Call — gemma4');
    expect(onCommand).not.toHaveBeenCalled();
    expect(ollama.streamChat).not.toHaveBeenCalled();

    submitInput('continue');
    rerender(chat);
    await waitForStream();
    expect(lastFrame()).not.toContain('Session Stats');
  });

  it('reports completed model call stats', async () => {
    const onModelCall = vi.fn();
    const callStats = {
      model: 'gemma4',
      promptTokens: 100,
      outputTokens: 20,
      totalDurationNs: 5_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 900_000_000,
      evalDurationNs: 3_500_000_000,
    };
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done' };
      yield { type: 'stats', stats: callStats };
    });
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        onModelCall={onModelCall}
        mode={MODE.SAFE}
        onModeChange={onModeChange}
        sessionId="0"
      />
    );
    const { rerender } = renderWithTheme(chat);

    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(onModelCall).toHaveBeenCalledOnce();
    expect(onModelCall).toHaveBeenCalledWith(callStats);
  });

  it('runs a shell command locally without calling the LLM', async () => {
    toolMocks.runShell.mockResolvedValue({ content: 'file1.txt\nfile2.txt' });
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
    const { lastFrame, rerender } = renderWithTheme(chat);
    submitInput('!ls');
    rerender(chat);
    await waitForStream();

    expect(toolMocks.runShell).toHaveBeenCalledWith('ls');
    expect(onCommand).not.toHaveBeenCalled();
    expect(ollama.streamChat).not.toHaveBeenCalled();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('!ls');
    expect(frame).toContain('$ ls');
    expect(frame).toContain('file1.txt');
  });

  it('includes the error in the output when a shell command fails', async () => {
    toolMocks.runShell.mockResolvedValue({
      content: '',
      error: 'Command failed: exit code 1',
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
    submitInput('!badcmd');
    rerender(chat);
    await waitForStream();

    expect(toolMocks.runShell).toHaveBeenCalledWith('badcmd');
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Error: Command failed: exit code 1');
  });

  it('does not run a shell command for a bare "!"', async () => {
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
    submitInput('!');
    rerender(chat);
    await time.tick();

    expect(toolMocks.runShell).not.toHaveBeenCalled();
  });

  it('compacts the conversation and replaces messages', async () => {
    const onCommand = vi.fn();
    const onMessagesReplace = vi.fn();
    const onModelCall = vi.fn();
    const callStats = {
      model: 'gemma4',
      promptTokens: 100,
      outputTokens: 20,
      totalDurationNs: 5_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 900_000_000,
      evalDurationNs: 3_500_000_000,
    };
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Mocked response' };
      yield { type: 'stats', stats: callStats };
    });
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
        onModelCall={onModelCall}
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
    expect(onModelCall).toHaveBeenCalledWith(callStats);
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
  });

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
      { allowedTools: undefined, mode: MODE.SAFE },
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

    await vi.waitFor(() => {
      expect(tools.executeTool).toHaveBeenCalledTimes(2);
    });
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('All tools completed.');
  });

  it('continues execution when the model returns empty content after a tool result', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Execution completed.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });

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

    submitInput('execute the change');
    rerender(chat);
    await vi.waitFor(() => {
      expect(tools.executeTool).toHaveBeenCalledTimes(2);
    });
    rerender(chat);

    expect(streamChat).toHaveBeenCalledTimes(4);
    const continuationMessages = vi.mocked(streamChat).mock.calls[2]?.[0] as
      ollama.Message[] | undefined;
    expect(
      continuationMessages?.some((message) =>
        message.content.includes(
          'A tool result was returned but the turn has not been completed.',
        ),
      ),
    ).toBe(true);
    expect(lastFrame()).toContain('Execution completed.');
  });

  it('reports repeated empty responses after a tool result', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'contents' });

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

    submitInput('execute the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(4);
    expect(lastFrame()).toContain(
      'Error: The model stopped before completing the turn after receiving tool results.',
    );
  });

  it('keeps tool-intent retries after empty-response retries', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'I will now proceed with editing the prompt.',
      };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Execution completed.' };
    });
    vi.mocked(ollama.hasUncalledToolIntent).mockImplementation((content) =>
      content.includes('proceed with editing'),
    );
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });

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

    submitInput('execute the change');
    rerender(chat);
    await vi.waitFor(() => {
      expect(tools.executeTool).toHaveBeenCalledTimes(2);
    });
    rerender(chat);

    const intentRetryMessages = vi.mocked(streamChat).mock.calls[4]?.[0] as
      ollama.Message[] | undefined;
    expect(
      intentRetryMessages?.some(
        (message) => message.content === ollama.TOOL_INTENT_CORRECTION,
      ),
    ).toBe(true);
    expect(streamChat).toHaveBeenCalledTimes(6);
    expect(lastFrame()).toContain('Execution completed.');
  });

  it('reports repeated descriptions of uncalled tool actions', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'I will edit the file now.' };
    });
    vi.mocked(ollama.hasUncalledToolIntent).mockReturnValue(true);

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

    submitInput('execute the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(3);
    expect(lastFrame()).toContain(
      'Error: The model repeatedly described a tool action without calling it.',
    );
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
      ollama.Message[] | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content === 'Please call the appropriate tool now.',
      ),
    ).toBe(true);
  });

  it('keeps a failed state change pending through research until retry succeeds', async () => {
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'missing',
                newText: 'replacement',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'I will reread the file before retrying.',
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'unique before block',
                newText: 'unique after block',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The corrected edit succeeded.' };
    });
    vi.mocked(tools.executeTool)
      .mockResolvedValueOnce({
        content: '',
        error: 'Exact text matched multiple locations',
      })
      .mockResolvedValueOnce({ content: 'source' })
      .mockResolvedValueOnce({ content: 'edited' });

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

    submitInput('execute the change');
    rerender(chat);
    await vi.waitFor(() => {
      expect(tools.executeTool).toHaveBeenCalledTimes(3);
    });
    rerender(chat);

    const recoveryMessages = vi.mocked(ollama.streamChat).mock.calls[2][0];
    expect(
      recoveryMessages.some(({ content }) =>
        content.includes('Retry with one edit_file call using exactly:'),
      ),
    ).toBe(true);
    expect(lastFrame()).toContain('The corrected edit succeeded.');
  });

  it('accepts an explicit blocker after a failed state change', async () => {
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'missing',
                newText: 'replacement',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'The work is incomplete because the requested text is not present.',
      };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({
      content: '',
      error: 'Exact text not found',
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

    submitInput('execute the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'The work is incomplete because the requested text is not present.',
    );
    expect(lastFrame()).not.toContain('failed state change without retrying');
  });

  it('reports when failed state change corrections are exhausted', async () => {
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'missing',
                newText: 'replacement',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'I will try again later.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({
      content: '',
      error: 'Exact text not found',
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

    submitInput('execute the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(4);
    expect(lastFrame()).toContain(
      'Error: The model stopped after a failed state change without retrying or reporting a blocker.',
    );
  });

  it('requires command verification after a successful project mutation', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The edit is complete.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The verified edit is complete.' };
    });
    vi.mocked(tools.executeTool)
      .mockResolvedValueOnce({ content: 'edited' })
      .mockResolvedValueOnce({ content: 'lint passed' });

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

    submitInput('plan the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    const verificationMessages = vi.mocked(ollama.streamChat).mock.calls[3][0];
    expect(
      verificationMessages.some(({ content }) =>
        content.includes(
          'Project files changed after the last successful command-based verification.',
        ),
      ),
    ).toBe(true);
    expect(tools.executeTool).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('The verified edit is complete.');
  });

  it('recovers from a failed planned verification with a project check', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'run_shell',
              arguments: { command: 'npm run lint:tsc' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The replacement check passed.' };
    });
    vi.mocked(tools.executeTool)
      .mockResolvedValueOnce({ content: 'edited' })
      .mockResolvedValueOnce({
        content: '',
        error: 'Command failed: exit code 1',
      })
      .mockResolvedValueOnce({ content: 'type-check passed' });

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

    submitInput('plan the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    const messagesAfterFailure = vi.mocked(ollama.streamChat).mock.calls[3][0];
    const failedResult = messagesAfterFailure.find(
      ({ toolResult }) => toolResult?.name === 'run_shell',
    );
    expect(failedResult?.content).not.toContain('state-changing tool failed');
    expect(tools.executeTool).toHaveBeenCalledTimes(3);
    expect(lastFrame()).toContain('The replacement check passed.');
    expect(lastFrame()).not.toContain('stopped before verifying');
  });

  it('repairs failed verification and completes every planned target', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments(),
                tasks: [
                  {
                    action: 'change',
                    id: 'plan-review',
                    description: 'Update PlanReview',
                    dependencies: [],
                    targets: ['src/components/PlanReview/PlanReview.tsx'],
                    verification: 'PlanReview behavior is updated',
                  },
                  {
                    action: 'change',
                    id: 'chat',
                    description: 'Update Chat',
                    dependencies: ['plan-review'],
                    targets: ['src/components/Chat/Chat.tsx'],
                    verification: 'Chat behavior is updated',
                  },
                ],
                tests: ['npm run lint'],
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/components/PlanReview/PlanReview.tsx',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'Both component changes are complete.',
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/components/Chat/Chat.tsx',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'run_shell',
              arguments: {
                command:
                  'npm test -- run src/components/PlanReview/PlanReview.test.tsx',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'The failures confirm the intended behavior. I will update the tests.',
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/components/PlanReview/PlanReview.test.tsx',
                oldText: 'old expectation',
                newText: 'new expectation',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'run_shell',
              arguments: {
                command:
                  'npm test -- run src/components/PlanReview/PlanReview.test.tsx',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'run_shell',
              arguments: { command: 'npm run lint' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'All changes are verified.' };
    });
    vi.mocked(tools.executeTool)
      .mockResolvedValueOnce({ content: 'PlanReview edited' })
      .mockResolvedValueOnce({ content: 'Chat edited' })
      .mockResolvedValueOnce({
        content: '',
        error: 'Two tests failed',
      })
      .mockResolvedValueOnce({ content: 'tests edited' })
      .mockResolvedValueOnce({ content: 'tests passed' })
      .mockResolvedValueOnce({ content: 'lint passed' });

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

    submitInput('plan the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    const targetCorrection = vi.mocked(ollama.streamChat).mock.calls[3][0];
    expect(
      targetCorrection.some(({ content }) =>
        content.includes(
          'unresolved change targets: src/components/Chat/Chat.tsx',
        ),
      ),
    ).toBe(true);
    const repairCorrection = vi.mocked(ollama.streamChat).mock.calls[6][0];
    expect(
      repairCorrection.some(({ content }) =>
        content.includes('A failing check is not evidence of success'),
      ),
    ).toBe(true);
    expect(
      repairCorrection.some(({ content }) =>
        content.includes(
          'Use exactly one appropriate read, edit, write, or shell tool call',
        ),
      ),
    ).toBe(true);
    expect(tools.executeTool).toHaveBeenCalledTimes(6);
    expect(lastFrame()).toContain('All changes are verified.');
  });

  it('errors when verification corrections are exhausted', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The edit is complete.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Still working.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'edited' });

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

    submitInput('plan the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(5);
    expect(tools.executeTool).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain(
      'The model stopped before verifying changes made during this turn.',
    );
  });

  it('corrects serialized tool calls without bypassing Safe-mode approval', async () => {
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.hasSerializedToolCall).mockImplementation((content) =>
      content.includes('Tool edit_file('),
    );
    vi.mocked(ollama.hasUncalledToolIntent).mockImplementation((content) =>
      content.includes('Tool edit_file('),
    );
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'I will now apply the change.\n\nTool edit_file({"path":"src/constants/prompt.ts"})',
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Execution completed.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });

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

    submitInput('execute the change');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(tools.executeTool).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Approve');
    const correctionMessages = vi.mocked(ollama.streamChat).mock.calls[1][0];
    expect(
      correctionMessages.some(
        ({ content }) => content === ollama.TOOL_INTENT_CORRECTION,
      ),
    ).toBe(true);
    expect(correctionMessages).toContainEqual({
      role: ROLE.ASSISTANT,
      content: 'The model printed a tool call instead of invoking it.',
    });
    expect(
      correctionMessages.some(({ content }) =>
        content.includes('Tool edit_file('),
      ),
    ).toBe(false);

    chooseToolDecision(DECISION.APPROVE);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Execution completed.');
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
      ollama.Message[] | undefined;
    expect(
      secondCallMessages?.some(
        (message) =>
          message.role === 'system' &&
          message.content.includes('Unknown tool: writeFile'),
      ),
    ).toBe(true);
  });

  it('renders tool progress while tools are running', async () => {
    const { streamChat } = ollama;
    let resolveTool!: (value: ToolResult) => void;

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

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done.' };
    });

    vi.mocked(tools.executeTool).mockImplementationOnce(
      () =>
        new Promise<ToolResult>((resolve) => {
          resolveTool = resolve;
        }),
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

    await typeText(rerender, 'read file', chat);
    submitInput('read file');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Processing 1 tool call');

    resolveTool({ content: 'file contents' });
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('❖ read_file completed');
    expect(lastFrame()).toContain('Done.');
  });

  it('continues after malformed tool calls in safe mode without executing them', async () => {
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
      yield {
        type: 'content',
        content: 'Malformed call handled in safe mode.',
      };
    });

    vi.mocked(tools.normalizeToolCall).mockImplementation((toolCall) => {
      if (toolCall.function.name === 'writeFile') {
        throw new Error('Unknown tool: writeFile');
      }
      return {
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        requiresApproval: tools.WRITE_TOOLS.has(toolCall.function.name),
      };
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

    await typeText(rerender, 'write a file', chat);
    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Malformed call handled in safe mode.');
    const secondCallMessages = vi.mocked(streamChat).mock.calls[1]?.[0] as
      ollama.Message[] | undefined;
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
      ollama.Message[] | undefined;
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

  it('renders a submitted ready plan and opens plan review', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('## Proposed Plan');
    expect(lastFrame()).toContain('1. Update the file');
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
    expect(ollama.streamChat).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['needs_input' as const, '## Plan Needs Input'],
    ['answer' as const, '## Answer'],
  ])(
    'renders a %s submission without plan review',
    async (outcome, heading) => {
      vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield finishPlanModeChunk(outcome);
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

      submitInput('consider this');
      rerender(chat);
      await waitForStream();
      rerender(chat);

      expect(lastFrame()).toContain(heading);
      expect(lastFrame()).not.toContain('Plan Review - Choose next step:');
    },
  );

  it('resumes Plan mode with a selected clarification answer', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  {
                    prompt: 'Which behavior should be used?',
                    options: ['Safe', 'Fast'],
                  },
                ],
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    const onModeChange = vi.fn();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Plan Clarification - Choose an answer:');
    expect(lastFrame()).toContain('Safe');
    choosePlanQuestion('0');
    await waitForStream();
    rerender(chat);

    const answerMessages = vi.mocked(ollama.streamChat).mock.calls[1]?.[0] as
      ollama.Message[] | undefined;
    expect(
      answerMessages?.findLast(({ role }) => role === ROLE.USER),
    ).toMatchObject({
      role: ROLE.USER,
      content: 'Safe',
    });
    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('corrects embedded question choices into selectable options', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  'Which timeout should change? (e.g., streamChat, generateStructuredChat)',
                ],
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  {
                    prompt: 'Which timeout should change?',
                    options: ['streamChat', 'generateStructuredChat'],
                  },
                ],
              },
            },
          },
        ],
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

    submitInput('Plan a change to the timeout');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    const correctionMessages = vi.mocked(ollama.streamChat).mock.calls[1][0];
    expect(
      correctionMessages.some(({ content }) =>
        content.includes(
          'options are required when the prompt presents predefined choices',
        ),
      ),
    ).toBe(true);
    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('Plan Clarification - Choose an answer:');
    expect(lastFrame()).toContain('streamChat');
    expect(lastFrame()).toContain('generateStructuredChat');
  });

  it('corrects a free-text question when the user requests options', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  {
                    prompt: 'Which timeout should change?',
                    options: [],
                  },
                ],
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  {
                    prompt: 'Which timeout should change?',
                    options: ['Streaming timeout', 'Tool timeout'],
                  },
                ],
              },
            },
          },
        ],
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

    submitInput('Can you suggest options?');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    const correctionMessages = vi.mocked(ollama.streamChat).mock.calls[1][0];
    expect(
      correctionMessages.some(({ content }) =>
        content.includes(
          'needs_input submissions must provide options when the user requests them',
        ),
      ),
    ).toBe(true);
    expect(lastFrame()).toContain('Plan Clarification - Choose an answer:');
    expect(lastFrame()).toContain('Streaming timeout');
    expect(lastFrame()).toContain('Tool timeout');
  });

  it('returns to chat input for a custom clarification answer', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: {
                ...planArguments('needs_input'),
                questions: [
                  {
                    prompt: 'Which behavior should be used?',
                    options: ['Safe', 'Fast'],
                  },
                ],
              },
            },
          },
        ],
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanQuestion('custom');
    await time.tick();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledOnce();
    expect(lastFrame()).not.toContain('Plan Clarification - Choose an answer:');
    expect(lastFrame()).toContain('>');
  });

  it('executes read-only research before accepting a plan', async () => {
    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );
    vi.mocked(tools.executeTool).mockResolvedValue({
      content: 'file contents',
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('research and plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).toHaveBeenCalledWith(
      'read_file',
      { path: '/notes.md' },
      { allowedTools: tools.READ_TOOLS, mode: MODE.PLAN },
    );
    expect(lastFrame()).toContain('❖ read_file completed');
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('retries once when the model returns prose instead of finish_plan_mode', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    tools.READ_TOOLS.add('read_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Here is a Markdown plan.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
    const retryMessages = vi.mocked(ollama.streamChat).mock.calls[1]?.[0] as
      ollama.Message[] | undefined;
    expect(
      retryMessages?.some((message) =>
        message.content.includes(
          'If more research is needed, call the next read-only tool now',
        ),
      ),
    ).toBe(true);
    const retryTools = vi.mocked(ollama.streamChat).mock.calls[1]?.[2] as
      { function: { name: string } }[] | undefined;
    expect(
      retryTools?.map(({ function: toolFunction }) => toolFunction.name),
    ).toEqual(['read_file', 'finish_plan_mode']);
  });

  it('continues read-only research after a missing plan submission', async () => {
    tools.TOOLS.push(
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'finish_plan_mode',
          description: 'Submit the plan',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    );
    tools.READ_TOOLS.add('read_file');
    vi.mocked(ollama.streamChat)
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'I need to inspect one more file.' };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'read_file',
                arguments: { path: 'src/components/Chat/plan.ts' },
              },
            },
          ],
        };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield finishPlanModeChunk('answer');
      });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'source' });

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

    submitInput('Explain where Plan mode is implemented');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(3);
    expect(tools.executeTool).toHaveBeenCalledWith(
      'read_file',
      { path: 'src/components/Chat/plan.ts' },
      { allowedTools: tools.READ_TOOLS, mode: MODE.PLAN },
    );
    expect(lastFrame()).toContain('## Answer');
    expect(lastFrame()).not.toContain('Plan submission was not accepted');
  });

  it('allows an answer outcome when the plan turn has no user request', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk('answer');
    });
    const dispatch = vi.fn();

    function RunTurnReadOnly() {
      const abortControllerRef = useRef<AbortController | null>(null);
      const { runTurnReadOnly } = useRunTurn({
        abortControllerRef,
        dispatch,
        model: 'gemma4',
        mode: MODE.PLAN,
        theme: THEME.getTheme(),
      });

      useEffect(() => {
        void runTurnReadOnly([]);
      }, [runTurnReadOnly]);

      return null;
    }

    renderWithTheme(<RunTurnReadOnly />);

    await vi.waitFor(() => {
      expect(tools.getToolDefinitions).toHaveBeenCalledWith({
        mode: MODE.PLAN,
        allowPlanAnswer: true,
      });
    });
  });

  it('shows a recoverable error after two missing submissions', async () => {
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Markdown only.' };
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'Error: Plan mode requires a valid standalone finish_plan_mode tool call.',
    );
  });

  it('recovers missing tool submissions with schema-constrained output', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Markdown only.' };
    });
    vi.mocked(ollama.generateStructuredChat).mockResolvedValueOnce({
      content: JSON.stringify({
        outcome: 'answer',
        title: 'Plan mode location',
        summary: 'Plan mode is implemented in the Chat flow.',
      }),
      stats: {
        model: 'gemma4',
        promptTokens: 40,
        outputTokens: 10,
        totalDurationNs: 2_000_000_000,
        loadDurationNs: 100_000_000,
        promptEvalDurationNs: 500_000_000,
        evalDurationNs: 1_000_000_000,
      },
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

    submitInput('explain Plan mode');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('## Plan mode location');
    expect(lastFrame()).toContain('implemented in the Chat flow');
    expect(lastFrame()).not.toContain('Error: Plan mode requires');
    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(tools.getToolDefinitions).toHaveBeenCalledWith({
      mode: MODE.PLAN,
      allowPlanAnswer: true,
    });
  });

  it('rejects an answer outcome for a requested plan', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    vi.mocked(ollama.streamChat)
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'I need more context.' };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield finishPlanModeChunk('answer');
      });
    vi.mocked(ollama.generateStructuredChat).mockResolvedValueOnce({
      content: JSON.stringify({
        outcome: 'needs_input',
        title: 'Clarify the documentation change',
        summary: 'The requested change needs a specific target.',
        questions: ['Which part of the Plan mode documentation should change?'],
      }),
      stats: {
        model: 'gemma4',
        promptTokens: 40,
        outputTokens: 10,
        totalDurationNs: 2_000_000_000,
        loadDurationNs: 100_000_000,
        promptEvalDurationNs: 500_000_000,
        evalDurationNs: 1_000_000_000,
      },
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

    submitInput('Plan a small change to the Plan mode documentation');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(tools.getToolDefinitions).toHaveBeenCalledWith({
      mode: MODE.PLAN,
      allowPlanAnswer: false,
    });
    expect(lastFrame()).toContain('## Plan Needs Input');
    expect(lastFrame()).toContain(
      'Which part of the Plan mode documentation should change?',
    );
  });

  it('shows an error when structured plan recovery returns invalid plans', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidFinishPlanModeChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {},
          },
        },
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });

    const invalidPlan = JSON.stringify({ outcome: 'invalid' });
    vi.mocked(ollama.generateStructuredChat)
      .mockResolvedValueOnce({
        content: invalidPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
      })
      .mockResolvedValueOnce({
        content: invalidPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledTimes(2);
    const frame = (lastFrame() ?? '').replace(/\s+/g, ' ');
    expect(frame).toContain(
      'Error: Plan mode could not accept finish_plan_mode:',
    );
    expect(frame).toContain('outcome must be ready, needs_input, or answer');
  });

  it('shows an error when structured plan recovery returns a non-object', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidFinishPlanModeChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {},
          },
        },
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });

    const nonObjectPlan = JSON.stringify(null);
    vi.mocked(ollama.generateStructuredChat)
      .mockResolvedValueOnce({
        content: nonObjectPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
      })
      .mockResolvedValueOnce({
        content: nonObjectPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'Error: Plan mode could not accept finish_plan_mode:',
    );
    expect(lastFrame()).toContain(
      'finish_plan_mode arguments must be an object',
    );
  });

  it('shows an error when structured plan recovery cannot be retrieved', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain(
      'Error: Plan mode could not recover finish_plan_mode: Structured plan unavailable',
    );
  });

  it('shows an error when structured plan recovery cannot render the plan', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidFinishPlanModeChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {},
          },
        },
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });

    const validPlan = JSON.stringify({
      outcome: 'answer',
      title: 'Recovered answer',
      summary: 'The structured response was accepted.',
    });
    vi.mocked(ollama.generateStructuredChat)
      .mockResolvedValueOnce({
        content: validPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
      })
      .mockResolvedValueOnce({
        content: validPlan,
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
      });

    vi.mocked(prewarmCodeBlocks)
      .mockRejectedValueOnce('')
      .mockRejectedValueOnce('');

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

    submitInput('explain the current plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'Error: Plan mode could not accept finish_plan_mode:',
    );
    expect(lastFrame()).toContain('outcome must be a non-empty string');
  });

  it('executes batched research and requires finish_plan_mode to be resubmitted alone', async () => {
    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'contents' });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
          finishPlanModeChunk().tool_calls[0],
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('research and plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).toHaveBeenCalledWith(
      'read_file',
      { path: '/notes.md' },
      { allowedTools: tools.READ_TOOLS, mode: MODE.PLAN },
    );
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
    const retryMessages = vi.mocked(ollama.streamChat).mock.calls[1]?.[0] as
      ollama.Message[] | undefined;
    expect(
      retryMessages?.some((message) =>
        message.content.includes('must be the only tool call'),
      ),
    ).toBe(true);
  });

  it('blocks destructive research tools and still accepts a later plan', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('write a file');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).not.toHaveBeenCalled();
    expect(lastFrame()).toContain(
      'Plan mode policy: write_file cannot be executed during planning',
    );
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('executes the exact approved plan snapshot in auto mode', async () => {
    const onModeChange = vi.fn();
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Executed automatically.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.AUTO);
    const executionMessages = vi.mocked(ollama.streamChat).mock
      .calls[1]?.[0] as ollama.Message[] | undefined;
    const instruction = executionMessages?.find((message) =>
      message.content.includes('Approved plan snapshot:'),
    );
    expect(instruction?.content).toContain(
      JSON.stringify(planArguments(), null, 2),
    );
    expect(lastFrame()).toContain('Executed automatically.');
  });

  it('does not silently stop an approved plan before making changes', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'What small change do you want to implement?',
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'I still need more details.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'I still did not make the change.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'source' });

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

    submitInput('make a concrete plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    const correctionMessages = vi.mocked(ollama.streamChat).mock.calls[3][0];
    expect(
      correctionMessages.some(({ content }) =>
        content.includes('unresolved change targets: src/constants/prompt.ts'),
      ),
    ).toBe(true);
    expect(
      correctionMessages.some(({ content }) =>
        content.includes(
          'Call the appropriate state-changing tool now to complete those targets.',
        ),
      ),
    ).toBe(true);
    expect(lastFrame()).toContain(
      'Error: The model stopped before completing the changes from the approved plan.',
    );
  });

  it('accepts a verified no-op after rereading a target following a failed edit', async () => {
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'missing',
                newText: 'replacement',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/constants/prompt.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'No changes are needed because the requested behavior is already implemented in src/constants/prompt.ts.',
      };
    });
    vi.mocked(tools.executeTool)
      .mockResolvedValueOnce({
        content: '',
        error: 'Exact text not found',
      })
      .mockResolvedValueOnce({ content: 'existing behavior' });

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

    submitInput('make a concrete plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('No changes are needed');
    expect(lastFrame()).not.toContain(
      'failed state change without retrying or reporting a blocker',
    );
    expect(lastFrame()).not.toContain(
      'stopped before completing the changes from the approved plan',
    );
  });

  it('completes an approved read-only plan without requiring a mutation', async () => {
    const readOnlyPlan = {
      ...planArguments(),
      tasks: [
        {
          action: 'inspect',
          id: 'task-1',
          description: 'Inspect the Plan mode implementation',
          dependencies: [],
          targets: [],
          verification: 'Summarize the relevant source locations',
        },
      ],
      tests: [],
    };
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: readOnlyPlan,
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'read_file',
              arguments: { path: 'src/components/Chat/plan.ts' },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The inspection is complete.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'source' });

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

    submitInput('Plan how to inspect Plan mode');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('The inspection is complete.');
    expect(lastFrame()).not.toContain(
      'stopped before completing the changes from the approved plan',
    );
  });

  it('requires verification after an approved MCP mutation', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'mcp__filesystem__edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                edits: [{ oldText: 'before', newText: 'after' }],
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The MCP edit succeeded.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'The verified MCP edit is complete.' };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });

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

    submitInput('make a concrete plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    const verificationMessages = vi.mocked(ollama.streamChat).mock.calls[3][0];
    expect(
      verificationMessages.some(({ content }) =>
        content.includes(
          'Project files changed after the last successful command-based verification.',
        ),
      ),
    ).toBe(true);
    expect(lastFrame()).toContain('The verified MCP edit is complete.');
    expect(lastFrame()).not.toContain(
      'stopped before completing the changes from the approved plan',
    );
  });

  it('retries an empty initial response after approving a plan', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Executed automatically.' };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
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
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'Executed and verified automatically.',
      };
    });
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'ok' });

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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await vi.waitFor(() => {
      expect(tools.executeTool).toHaveBeenCalledTimes(2);
    });
    rerender(chat);

    const retryMessages = vi.mocked(ollama.streamChat).mock.calls[2]?.[0] as
      ollama.Message[] | undefined;
    expect(
      retryMessages?.some((message) =>
        message.content.includes(
          'The response was empty and the turn has not been completed.',
        ),
      ),
    ).toBe(true);
    expect(ollama.streamChat).toHaveBeenCalledTimes(6);
    expect(lastFrame()).toContain('Executed and verified automatically.');
  });

  it('reports repeated empty responses after approving a plan', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: '' };
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.AUTO);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(4);
    expect(lastFrame()).toContain(
      'Error: The model stopped before completing the turn without producing a response.',
    );
  });

  it('executes the approved plan snapshot in safe mode one step at a time', async () => {
    const onModeChange = vi.fn();
    tools.WRITE_TOOLS.add('edit_file');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'edit_file',
              arguments: {
                path: 'src/constants/prompt.ts',
                oldText: 'before',
                newText: 'after',
              },
            },
          },
        ],
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.SAFE);
    await waitForStream();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.SAFE);
    const executionMessages = vi.mocked(ollama.streamChat).mock
      .calls[1]?.[0] as ollama.Message[] | undefined;
    const instruction = executionMessages?.find((message) =>
      message.content.includes('Approved plan snapshot:'),
    );
    expect(instruction?.content).toContain(
      'Execute the approved plan snapshot below one step at a time.',
    );
    expect(instruction?.content).toContain(
      JSON.stringify(planArguments(), null, 2),
    );
    expect(lastFrame()).toContain('Approve tool call');
  });

  it('continues planning without executing the submitted plan', async () => {
    const onModeChange = vi.fn();
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    choosePlanMode(MODE.PLAN);
    await time.tick();
    rerender(chat);

    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
    expect(lastFrame()).toContain(
      'Continuing in Plan mode. No tools were executed.',
    );
  });

  it('reports model call stats during plan research', async () => {
    const onModelCall = vi.fn();
    const callStats = {
      model: 'gemma4',
      promptTokens: 100,
      outputTokens: 20,
      totalDurationNs: 5_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 900_000_000,
      evalDurationNs: 3_500_000_000,
    };
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'stats', stats: callStats };
      yield { type: 'tool_calls', tool_calls: [] };
      yield finishPlanModeChunk();
    });

    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onModeChange={vi.fn()}
        onModelCall={onModelCall}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(onModelCall).toHaveBeenCalledWith(callStats);
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('reports an error when finish_plan_mode arguments are invalid', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidFinishPlanModeChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {},
          },
        },
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'Error: Plan mode could not accept finish_plan_mode: Structured plan unavailable',
    );
  });

  it('recovers invalid finish_plan_mode arguments with structured output', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidFinishPlanModeChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {},
          },
        },
      ],
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield invalidFinishPlanModeChunk();
    });
    vi.mocked(ollama.generateStructuredChat).mockResolvedValueOnce({
      content: JSON.stringify(planArguments()),
      stats: {
        model: 'gemma4',
        promptTokens: 40,
        outputTokens: 10,
        totalDurationNs: 2_000_000_000,
        loadDurationNs: 100_000_000,
        promptEvalDurationNs: 500_000_000,
        evalDurationNs: 1_000_000_000,
      },
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('specializes structured recovery after selecting an answer outcome', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              description: 'Plan outcome',
            },
            title: { type: 'string', description: 'Title' },
            summary: { type: 'string', description: 'Summary' },
            tasks: { type: 'array', description: 'Tasks' },
            tests: { type: 'array', description: 'Tests' },
            assumptions: { type: 'array', description: 'Assumptions' },
            questions: { type: 'array', description: 'Questions' },
          },
          required: [
            'outcome',
            'title',
            'summary',
            'tasks',
            'tests',
            'assumptions',
            'questions',
          ],
        },
      },
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Prose only.' };
    });
    const stats = {
      model: 'gemma4',
      promptTokens: 40,
      outputTokens: 10,
      totalDurationNs: 2_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 500_000_000,
      evalDurationNs: 1_000_000_000,
    };
    vi.mocked(ollama.generateStructuredChat)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          ...planArguments('answer'),
          tasks: [
            {
              id: 'task-1',
              description: 'Unnecessary implementation task',
              dependencies: [],
              verification: 'Not applicable',
            },
          ],
        }),
        stats,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(planArguments('answer')),
        stats,
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

    submitInput('Explain Plan mode');
    rerender(chat);
    await vi.waitFor(() => {
      expect(ollama.generateStructuredChat).toHaveBeenCalledTimes(2);
    });
    rerender(chat);

    expect(
      vi.mocked(ollama.generateStructuredChat).mock.calls[1][2],
    ).toMatchObject({
      properties: {
        outcome: { enum: ['answer'] },
        tasks: { maxItems: 0 },
        tests: { maxItems: 0 },
        assumptions: { maxItems: 0 },
        questions: { maxItems: 0 },
      },
    });
    expect(lastFrame()).toContain('## Answer');
    expect(lastFrame()).not.toContain('Error: Plan mode could not recover');
  });

  it('corrects a structured needs_input plan without questions', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    const invalidNeedsInputChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'finish_plan_mode',
            arguments: {
              outcome: 'needs_input',
              title: 'Clarify the template',
              summary: 'The requested improvement needs clarification.',
            },
          },
        },
      ],
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield invalidNeedsInputChunk();
    });
    const stats = {
      model: 'gemma4',
      promptTokens: 40,
      outputTokens: 10,
      totalDurationNs: 2_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 500_000_000,
      evalDurationNs: 1_000_000_000,
    };
    vi.mocked(ollama.generateStructuredChat)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          outcome: 'needs_input',
          title: 'Clarify the template',
          summary: 'The requested improvement needs clarification.',
          tasks: [],
          tests: [],
          assumptions: [],
          questions: [],
        }),
        stats,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          outcome: 'needs_input',
          title: 'Clarify the template',
          summary: 'The requested improvement needs clarification.',
          tasks: [],
          tests: [],
          assumptions: [],
          questions: [
            {
              prompt: 'Which part of the template should be improved?',
              options: [],
            },
          ],
        }),
        stats,
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

    submitInput('improve template');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledTimes(2);
    const correctedMessages = vi
      .mocked(ollama.generateStructuredChat)
      .mock.calls.at(-1)?.[0];
    expect(
      correctedMessages?.some(({ content }) =>
        content.includes('needs_input plans require exactly one question'),
      ),
    ).toBe(true);
    expect(ollama.generateStructuredChat).toHaveBeenLastCalledWith(
      correctedMessages,
      'gemma4',
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(lastFrame()).toContain('## Plan Needs Input');
    expect(lastFrame()).toContain(
      'Which part of the template should be improved?',
    );
  });

  it('reports an error when batched finish_plan_mode exceeds correction limit', async () => {
    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'contents' });

    const batchedChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: '/notes.md' },
          },
        },
        finishPlanModeChunk().tool_calls[0],
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield batchedChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield batchedChunk();
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

    submitInput('research and plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(tools.executeTool).toHaveBeenCalledTimes(2);
    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain(
      'Error: Plan mode requires finish_plan_mode as one standalone tool call.',
    );
  });

  it('recovers repeated batched finish_plan_mode with structured output', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'contents' });
    const batchedChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: '/notes.md' },
          },
        },
        finishPlanModeChunk().tool_calls[0],
      ],
    });
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield batchedChunk();
    });
    vi.mocked(ollama.generateStructuredChat).mockResolvedValueOnce({
      content: JSON.stringify(planArguments()),
      stats: {
        model: 'gemma4',
        promptTokens: 40,
        outputTokens: 10,
        totalDurationNs: 2_000_000_000,
        loadDurationNs: 100_000_000,
        promptEvalDurationNs: 500_000_000,
        evalDurationNs: 1_000_000_000,
      },
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

    submitInput('research and plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('retries when finish_plan_mode arguments are missing', async () => {
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'finish_plan_mode',
              arguments: undefined as unknown as Record<string, unknown>,
            },
          },
        ],
      };
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
  });

  it('retries when plan preparation throws a non-Error value', async () => {
    vi.mocked(prewarmCodeBlocks).mockRejectedValueOnce('string error');
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
    });
    vi.mocked(ollama.streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.streamChat).toHaveBeenCalledTimes(2);
    expect(lastFrame()).toContain('Plan Review - Choose next step:');
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
      ollama.Message[] | undefined;
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
      { allowedTools: undefined, mode: MODE.AUTO },
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

    // Second call explicitly reports that the failed tool is blocked.
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content: 'The work is incomplete because permission was denied.',
      };
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
      yield finishPlanModeChunk();
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

    // The empty response should not add an empty assistant message and should
    // proceed to the required plan submission retry.
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

  it('does not commit stale Plan recovery output after interruption', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });
    vi.mocked(ollama.streamChat)
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'First invalid Plan response.' };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'Second partial Plan response.' };
      });

    let resolveRecovery:
      | ((
          value: Awaited<ReturnType<typeof ollama.generateStructuredChat>>,
        ) => void)
      | undefined;
    vi.mocked(ollama.generateStructuredChat).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRecovery = resolve;
        }),
    );
    const onMessagesChange = vi.fn();
    const chat = (
      <Chat
        model="gemma4"
        onCommand={vi.fn()}
        mode={MODE.PLAN}
        onMessagesChange={onMessagesChange}
        onModeChange={vi.fn()}
        sessionId="0"
      />
    );
    const { lastFrame, rerender } = renderWithTheme(chat);

    submitInput('Explain Plan mode');
    rerender(chat);
    await waitForStream();
    rerender(chat);
    await waitForStream();
    rerender(chat);
    await vi.waitFor(() => {
      expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    });

    fireInterrupt();
    rerender(chat);
    resolveRecovery?.({
      content: JSON.stringify(planArguments('answer')),
      stats: {
        model: 'gemma4',
        promptTokens: 40,
        outputTokens: 10,
        totalDurationNs: 2_000_000_000,
        loadDurationNs: 100_000_000,
        promptEvalDurationNs: 500_000_000,
        evalDurationNs: 1_000_000_000,
      },
    });
    await time.tick();
    rerender(chat);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Execution interrupted');
    expect(frame).not.toContain('Second partial Plan response.');
    expect(frame).not.toContain('Plan Review - Choose next step:');

    const latestMessages = onMessagesChange.mock.calls.at(-1)?.[0] as
      ollama.Message[] | undefined;
    expect(
      latestMessages?.some(({ content }) =>
        content.includes('Second partial Plan response.'),
      ),
    ).toBe(false);
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

    await vi.waitFor(() => {
      rerender(chat);
      expect(lastFrame()).toContain('Mocked response');
    });
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

    await vi.waitFor(() => {
      rerender(chat);
      expect(lastFrame()).toContain('Mocked response');
    });
  });

  it('auto-executes blocked MCP tool calls without showing an approval prompt', async () => {
    const { streamChat } = ollama;

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield {
        type: 'tool_calls',
        tool_calls: [
          {
            function: {
              name: 'mcp__docs__resolve',
              arguments: { libraryName: 'react' },
            },
          },
        ],
      };
    });

    vi.mocked(tools.normalizeToolCall).mockImplementationOnce((toolCall) => ({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
      requiresApproval: true,
    }));
    vi.mocked(tools.isMcpToolAllowedInMode).mockReturnValueOnce(false);

    const mockExecute = vi.fn().mockResolvedValue({
      content: '',
      error: 'Tool not allowed in safe mode',
    });
    vi.mocked(tools.executeTool).mockImplementation(mockExecute);

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

    submitInput('use mcp tool');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).not.toContain('Tool requires approval');
    expect(mockExecute).toHaveBeenCalledWith(
      'mcp__docs__resolve',
      { libraryName: 'react' },
      { allowedTools: undefined, mode: MODE.SAFE },
    );
    expect(tools.getToolDefinitions).toHaveBeenCalledWith({ mode: MODE.SAFE });
  });

  it('loads plan-mode visible tool definitions during plan research', async () => {
    const { streamChat } = ollama;

    vi.mocked(tools.getToolDefinitions).mockResolvedValueOnce([
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: null as unknown as string,
          description: 'Invalid tool',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ]);

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Plan Review');
    expect(tools.getToolDefinitions).toHaveBeenCalledWith({
      mode: MODE.PLAN,
      allowPlanAnswer: false,
    });
  });

  it('includes MCP tools allowed in plan mode in the read-only tool set', async () => {
    const { streamChat } = ollama;

    vi.mocked(tools.getToolDefinitions).mockResolvedValueOnce([
      {
        type: 'function',
        function: {
          name: 'mcp__docs__resolve',
          description: 'Resolve a library',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
    ]);

    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield finishPlanModeChunk();
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

    submitInput('make a plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(lastFrame()).toContain('Plan Review');
    expect(tools.getToolDefinitions).toHaveBeenCalledWith({
      mode: MODE.PLAN,
      allowPlanAnswer: false,
    });
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

    await vi.waitFor(() => {
      rerender(chat);
      expect(lastFrame()).toContain('Mocked response');
    });
  });

  it('reports a recoverable error when structured plan recovery fails after repeated batched submissions', async () => {
    tools.TOOLS.push({
      type: 'function',
      function: {
        name: 'finish_plan_mode',
        description: 'Submit the plan',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });

    vi.spyOn(tools.READ_TOOLS, 'has').mockImplementation(
      (name) => name === 'read_file',
    );
    vi.mocked(tools.executeTool).mockResolvedValue({ content: 'contents' });

    const batchedChunk = () => ({
      type: 'tool_calls' as const,
      tool_calls: [
        {
          function: {
            name: 'read_file',
            arguments: { path: '/notes.md' },
          },
        },
        finishPlanModeChunk().tool_calls[0],
      ],
    });

    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield batchedChunk();
    });

    vi.mocked(ollama.generateStructuredChat).mockRejectedValueOnce(
      'structured failed',
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

    submitInput('research and plan');
    rerender(chat);
    await waitForStream();
    rerender(chat);

    expect(ollama.generateStructuredChat).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain(
      'Error: Plan mode could not recover finish_plan_mode: structured failed',
    );
  });
});

describe('useRunTurn', () => {
  beforeEach(() => {
    resetChatMocks();
  });

  it('prompts the model to execute the pending mutation task when no target paths are set', async () => {
    const dispatch = vi.fn();
    const initialVerification = {
      commands: [],
      failedMutationPending: false,
      failedVerificationCommands: [],
      inspectedTargets: [],
      mutationCompleted: false,
      mutationRequired: true,
      mutationTargets: [],
      mutatedTargets: [],
      mutationTask: 'Update the chat component',
      postFailureInspectedTargets: [],
      remainingCommands: [],
      required: false,
      verifiedNoChangeTargets: [],
    };

    function RunTurn() {
      const abortControllerRef = useRef<AbortController | null>(null);
      const { runTurn } = useRunTurn({
        abortControllerRef,
        dispatch,
        model: 'gemma4',
        mode: MODE.AUTO,
        theme: THEME.getTheme(),
      });

      useEffect(() => {
        void runTurn(
          [{ role: ROLE.USER, content: 'Execute the plan' }],
          MODE.AUTO,
          initialVerification,
        );
      }, [runTurn]);

      return null;
    }

    renderWithTheme(<RunTurn />);

    await vi.waitFor(() => {
      const messages = dispatch.mock.calls.flatMap(
        ([action]) =>
          (action as { messages?: ollama.Message[] }).messages ?? [],
      );
      expect(
        messages.some(({ content }) =>
          content.includes(
            'Execute this pending change now: Update the chat component.',
          ),
        ),
      ).toBe(true);
    });
  });

  it('continues pending verification after a verified no-op with an uncalled tool intent', async () => {
    const dispatch = vi.fn();
    const initialVerification = {
      commands: ['npm test'],
      failedMutationPending: false,
      failedVerificationCommands: ['npm test'],
      inspectedTargets: ['src/app.ts'],
      mutationCompleted: false,
      mutationRequired: true,
      mutationTargets: ['src/app.ts'],
      mutatedTargets: [],
      postFailureInspectedTargets: [],
      remainingCommands: ['npm test'],
      required: true,
      verifiedNoChangeTargets: [],
    };
    vi.mocked(ollama.hasUncalledToolIntent).mockReturnValue(true);
    vi.mocked(ollama.streamChat).mockImplementation(async function* () {
      await Promise.resolve();
      yield {
        type: 'content',
        content:
          'No changes are needed because the requested behavior already exists.',
      };
    });

    function RunTurn() {
      const abortControllerRef = useRef<AbortController | null>(null);
      const { runTurn } = useRunTurn({
        abortControllerRef,
        dispatch,
        model: 'gemma4',
        mode: MODE.AUTO,
        theme: THEME.getTheme(),
      });

      useEffect(() => {
        void runTurn(
          [{ role: ROLE.USER, content: 'Execute the plan' }],
          MODE.AUTO,
          initialVerification,
        );
      }, [runTurn]);

      return null;
    }

    renderWithTheme(<RunTurn />);

    await vi.waitFor(() => {
      expect(ollama.streamChat).toHaveBeenCalledTimes(3);
    });
    const correctionMessages = vi.mocked(ollama.streamChat).mock.calls[1][0];
    expect(
      correctionMessages.some(({ content }) =>
        content.includes('A verification command failed.'),
      ),
    ).toBe(true);
  });

  it('prompts the model to execute the plan when no mutation task is set', async () => {
    const dispatch = vi.fn();
    const initialVerification = {
      commands: [],
      failedMutationPending: false,
      failedVerificationCommands: [],
      inspectedTargets: [],
      mutationCompleted: false,
      mutationRequired: true,
      mutationTargets: [],
      mutatedTargets: [],
      postFailureInspectedTargets: [],
      remainingCommands: [],
      required: false,
      verifiedNoChangeTargets: [],
    };

    function RunTurn() {
      const abortControllerRef = useRef<AbortController | null>(null);
      const { runTurn } = useRunTurn({
        abortControllerRef,
        dispatch,
        model: 'gemma4',
        mode: MODE.AUTO,
        theme: THEME.getTheme(),
      });

      useEffect(() => {
        void runTurn(
          [{ role: ROLE.USER, content: 'Execute the plan' }],
          MODE.AUTO,
          initialVerification,
        );
      }, [runTurn]);

      return null;
    }

    renderWithTheme(<RunTurn />);

    await vi.waitFor(() => {
      const messages = dispatch.mock.calls.flatMap(
        ([action]) =>
          (action as { messages?: ollama.Message[] }).messages ?? [],
      );
      expect(
        messages.some(({ content }) =>
          content.includes(
            'Continue now by calling the next required state-changing tool.',
          ),
        ),
      ).toBe(true);
    });
  });
});
