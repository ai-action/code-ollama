import type { ToolResult } from './types';

type RunAction = (
  model: string,
  prompt: string,
  options?: { trust?: boolean },
) => Promise<void>;
type ResumeAction = (sessionId?: string) => Promise<void>;

const {
  color,
  createSystemMessage,
  executeTool,
  getCurrentDirectory,
  getToolDefinitions,
  hasUncalledToolIntent,
  isDirectoryTrusted,
  loadSession,
  outputHelp,
  parse,
  promptForDirectoryTrust,
  renderApp,
  sanitizeAssistantContent,
  streamChat,
  trustDirectory,
  write,
  writeError,
} = vi.hoisted(() => ({
  color: vi.fn((text: string) => text),
  createSystemMessage: vi.fn(() => ({
    role: 'system',
    content: 'system prompt',
  })),
  executeTool: vi.fn(),
  getCurrentDirectory: vi.fn(() => '/trusted/project'),
  getToolDefinitions: vi.fn(() => Promise.resolve(['mock-tool'])),
  loadSession: vi.fn(),
  outputHelp: vi.fn(),
  parse: vi.fn(),
  promptForDirectoryTrust: vi.fn(),
  renderApp: vi.fn(),
  hasUncalledToolIntent: vi.fn(() => false),
  isDirectoryTrusted: vi.fn(() => true),
  sanitizeAssistantContent: vi.fn((content: string) => content),
  streamChat: vi.fn(),
  trustDirectory: vi.fn(),
  write: vi.fn(),
  writeError: vi.fn(),
}));

const commandState = vi.hoisted(() => ({
  runAction: null as RunAction | null,
  resumeAction: null as ResumeAction | null,
}));

const mockReset = vi.hoisted(() => vi.fn());

vi.mock('./utils', () => ({
  agents: { createSystemMessage },
  ollama: {
    streamChat,
    sanitizeAssistantContent,
    hasUncalledToolIntent,
    TOOL_INTENT_CORRECTION: 'Please call the appropriate tool now.',
  },
  screen: { reset: mockReset },
  session: { loadSession },
  terminal: { color, write, writeError },
  tools: {
    TOOLS: ['mock-tool'],
    getToolDefinitions,
    executeTool,
    executeToolCalls: async (
      toolCalls: {
        function: { name: string; arguments: Record<string, unknown> };
      }[],
    ) =>
      Promise.all(
        toolCalls.map(async (toolCall) => ({
          toolCall,
          result: (await executeTool(
            toolCall.function.name,
            toolCall.function.arguments,
          )) as ToolResult,
        })),
      ),
    executeToolCall: async (toolCall: {
      function: { name: string; arguments: Record<string, unknown> };
    }) => {
      const result = (await executeTool(
        toolCall.function.name,
        toolCall.function.arguments,
      )) as ToolResult;
      return result;
    },
    formatToolResultContent: (toolName: string, result: ToolResult) =>
      `Tool ${toolName} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}${result.stack ? `\nStack trace:\n${result.stack}` : ''}`,
  },
  trust: { getCurrentDirectory, isDirectoryTrusted, trustDirectory },
}));
vi.mock('./tui', () => ({ renderApp }));
vi.mock('./components/DirectoryTrustPrompt/prompt', () => ({
  promptForDirectoryTrust,
}));

vi.mock('cac', () => ({
  default: () => ({
    version: vi.fn(),
    help: vi.fn(),
    command: vi.fn((name: string) => {
      const command = {
        option: vi.fn(() => command),
        action: vi.fn((callback: RunAction) => {
          if (name.startsWith('resume ')) {
            commandState.resumeAction = callback as unknown as ResumeAction;
            return command;
          }

          commandState.runAction = callback;
          return command;
        }),
      };

      return command;
    }),
    outputHelp,
    parse,
  }),
}));

import { main } from './cli';

describe('cli', () => {
  beforeEach(() => {
    getCurrentDirectory.mockReturnValue('/trusted/project');
    isDirectoryTrusted.mockReturnValue(true);
    promptForDirectoryTrust.mockResolvedValue(true);
    write.mockReset();
    writeError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it('renders TUI with no args', async () => {
    await main([]);
    expect(isDirectoryTrusted).toHaveBeenCalledWith('/trusted/project');
    expect(mockReset).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith({});
    expect(parse).not.toHaveBeenCalled();
  });

  it('prompts before rendering TUI for an untrusted directory', async () => {
    isDirectoryTrusted.mockReturnValueOnce(false);
    promptForDirectoryTrust.mockResolvedValueOnce(true);

    await main([]);

    expect(promptForDirectoryTrust).toHaveBeenCalledWith('/trusted/project');
    expect(trustDirectory).toHaveBeenCalledWith('/trusted/project');
    expect(renderApp).toHaveBeenCalledWith({});
  });

  it('exits before rendering TUI when directory trust is rejected', async () => {
    isDirectoryTrusted.mockReturnValueOnce(false);
    promptForDirectoryTrust.mockResolvedValueOnce(false);

    await main([]);

    expect(process.exitCode).toBe(1);
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('calls parse for resume without rendering TUI directly', async () => {
    await main(['resume', 'session-1']);
    expect(parse).toHaveBeenCalledWith([
      'node',
      'code-ollama',
      'resume',
      'session-1',
    ]);
  });

  it.each(['--help', '--version', '-v'])(
    'calls parse with %s',
    async (flag) => {
      await main([flag]);
      expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', flag]);
    },
  );

  it('does not call outputHelp for --help (cac handles it)', async () => {
    await main(['--help']);
    expect(outputHelp).not.toHaveBeenCalled();
  });

  it('calls parse for run without rendering TUI', async () => {
    await main(['run', 'gemma4', 'review diff']);
    expect(renderApp).not.toHaveBeenCalled();
    expect(parse).toHaveBeenCalledWith([
      'node',
      'code-ollama',
      'run',
      'gemma4',
      'review diff',
    ]);
  });

  it('calls parse for run with --trust', async () => {
    await main(['run', '--trust', 'gemma4', 'review diff']);
    expect(parse).toHaveBeenCalledWith([
      'node',
      'code-ollama',
      'run',
      '--trust',
      'gemma4',
      'review diff',
    ]);
  });

  it('trusts the current directory and runs when run --trust is used', async () => {
    streamChat.mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Done.' };
    });

    await commandState.runAction?.('gemma4', 'review diff', { trust: true });

    expect(trustDirectory).toHaveBeenCalledWith('/trusted/project');
    expect(promptForDirectoryTrust).not.toHaveBeenCalled();
    expect(streamChat).toHaveBeenCalledOnce();
  });

  it('exits before one-off run when directory trust is rejected', async () => {
    isDirectoryTrusted.mockReturnValueOnce(false);
    promptForDirectoryTrust.mockResolvedValueOnce(false);

    await commandState.runAction?.('gemma4', 'review diff');

    expect(process.exitCode).toBe(1);
    expect(createSystemMessage).not.toHaveBeenCalled();
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('streams one-off run output with the provided model', async () => {
    streamChat.mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Review complete.' };
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(createSystemMessage).toHaveBeenCalledOnce();
    expect(getToolDefinitions).toHaveBeenCalledWith({ mode: 'auto' });
    expect(streamChat).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'review diff' },
      ],
      'gemma4',
      ['mock-tool'],
    );
    expect(write).toHaveBeenNthCalledWith(1, 'Review complete.');
    expect(write).toHaveBeenNthCalledWith(2, '\n');
  });

  it('executes tool calls and continues the run conversation', async () => {
    streamChat
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'run_shell',
                arguments: { command: 'git diff --stat' },
              },
            },
          ],
        };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'Diff reviewed.' };
      });
    executeTool.mockResolvedValueOnce({
      content: ' src/cli.tsx | 10 +++++++++-',
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(executeTool).toHaveBeenCalledWith('run_shell', {
      command: 'git diff --stat',
    });
    expect(streamChat).toHaveBeenNthCalledWith(
      2,
      [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'review diff' },
        { role: 'assistant', content: '' },
        {
          role: 'system',
          content: 'Tool run_shell result:\n src/cli.tsx | 10 +++++++++-',
        },
      ],
      'gemma4',
      ['mock-tool'],
    );
    expect(write).toHaveBeenNthCalledWith(1, 'Diff reviewed.');
    expect(write).toHaveBeenNthCalledWith(2, '\n');
  });

  it('includes tool execution errors in the follow-up run conversation', async () => {
    streamChat
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'run_shell',
                arguments: { command: 'git diff --stat' },
              },
            },
          ],
        };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'Tool error handled.' };
      });
    executeTool.mockResolvedValueOnce({
      content: 'partial output',
      error: 'shell failed',
      stack: 'Error: shell failed\n    at runShell',
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(streamChat).toHaveBeenNthCalledWith(
      2,
      [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'review diff' },
        { role: 'assistant', content: '' },
        {
          role: 'system',
          content:
            'Tool run_shell result:\npartial output\nError: shell failed\nStack trace:\nError: shell failed\n    at runShell',
        },
      ],
      'gemma4',
      ['mock-tool'],
    );
    expect(write).toHaveBeenNthCalledWith(1, 'Tool error handled.');
    expect(write).toHaveBeenNthCalledWith(2, '\n');
  });

  it('executes multiple tool calls before continuing the run conversation', async () => {
    streamChat
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'read_file',
                arguments: { path: 'src/cli.ts' },
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
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'Both tools handled.' };
      });
    executeTool
      .mockResolvedValueOnce({ content: 'file contents' })
      .mockResolvedValueOnce({ content: 'tests passed' });

    await commandState.runAction?.('gemma4', 'inspect and test');

    expect(executeTool).toHaveBeenNthCalledWith(1, 'read_file', {
      path: 'src/cli.ts',
    });
    expect(executeTool).toHaveBeenNthCalledWith(2, 'run_shell', {
      command: 'npm test',
    });
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, 'Both tools handled.');
    expect(write).toHaveBeenNthCalledWith(2, '\n');
  });

  it('retries with a correction message when tool intent is detected but no tool was called', async () => {
    hasUncalledToolIntent.mockReturnValueOnce(true).mockReturnValueOnce(false);
    streamChat
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'I will read the file.' };
      })
      .mockImplementationOnce(async function* () {
        await Promise.resolve();
        yield { type: 'content', content: 'Done.' };
      });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(streamChat).toHaveBeenNthCalledWith(
      2,
      [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'review diff' },
        { role: 'assistant', content: 'I will read the file.' },
        { role: 'system', content: 'Please call the appropriate tool now.' },
      ],
      'gemma4',
      ['mock-tool'],
    );
    expect(write).toHaveBeenNthCalledWith(1, 'I will read the file.');
    expect(write).toHaveBeenNthCalledWith(2, 'Done.');
    expect(write).toHaveBeenNthCalledWith(3, '\n');
  });

  it('reports run errors and sets exit code', async () => {
    streamChat.mockImplementationOnce(async function* () {
      await Promise.resolve();
      throw new Error('Ollama unavailable');
      yield { type: 'content', content: '' };
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(writeError).toHaveBeenCalledWith('Error: Ollama unavailable\n');
    expect(process.exitCode).toBe(1);
  });

  it('opens the session picker when resume is called without a sessionId', async () => {
    await commandState.resumeAction?.();

    expect(loadSession).not.toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith({
      initialScreen: 'session-manager',
    });
  });

  it('exits before opening the session picker when directory trust is rejected', async () => {
    isDirectoryTrusted.mockReturnValueOnce(false);
    promptForDirectoryTrust.mockResolvedValueOnce(false);

    await commandState.resumeAction?.();

    expect(process.exitCode).toBe(1);
    expect(loadSession).not.toHaveBeenCalled();
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('loads the requested session and renders the TUI for resume', async () => {
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: process.cwd() },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(loadSession).toHaveBeenCalledWith('session-1');
    expect(mockReset).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('exits before resuming a session when directory trust is rejected', async () => {
    isDirectoryTrusted.mockReturnValueOnce(false);
    promptForDirectoryTrust.mockResolvedValueOnce(false);
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: process.cwd() },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(loadSession).toHaveBeenCalledWith('session-1');
    expect(process.exitCode).toBe(1);
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('allows resume when session has no directory field (legacy session)', async () => {
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: undefined },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(renderApp).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(writeError).not.toHaveBeenCalled();
  });

  it('blocks TUI and errors when resuming a session from a different directory', async () => {
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: '/other/project' },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(color).toHaveBeenCalledWith(
      expect.stringContaining(
        'Cannot resume: session belongs to /other/project',
      ),
      'yellow',
    );
    expect(writeError).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('reports resume errors and sets exit code', async () => {
    loadSession.mockImplementationOnce(() => {
      throw new Error('Session not found: missing');
    });

    await commandState.resumeAction?.('missing');

    expect(writeError).toHaveBeenCalledWith(
      'Error: Session not found: missing\n',
    );
    expect(process.exitCode).toBe(1);
  });

  it('reports unknown resume errors for non-Error throws', async () => {
    loadSession.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'boom';
    });

    await commandState.resumeAction?.('missing');

    expect(writeError).toHaveBeenCalledWith('Error: Unknown error\n');
    expect(process.exitCode).toBe(1);
  });
});
