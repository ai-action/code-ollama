type RunAction = (model: string, prompt: string) => Promise<void>;
type ResumeAction = (sessionId: string) => Promise<void>;

const {
  color,
  createSystemMessage,
  executeTool,
  loadSession,
  outputHelp,
  parse,
  renderApp,
  streamChat,
  write,
  writeError,
} = vi.hoisted(() => ({
  createSystemMessage: vi.fn(() => ({
    role: 'system',
    content: 'system prompt',
  })),
  color: vi.fn((text: string) => text),
  executeTool: vi.fn(),
  loadSession: vi.fn(),
  outputHelp: vi.fn(),
  parse: vi.fn(),
  renderApp: vi.fn(),
  streamChat: vi.fn(),
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
  ollama: { streamChat },
  screen: { reset: mockReset },
  session: { loadSession },
  terminal: { color, write, writeError },
  tools: { TOOLS: ['mock-tool'], executeTool },
}));
vi.mock('./tui', () => ({ renderApp }));

vi.mock('cac', () => ({
  default: () => ({
    version: vi.fn(),
    help: vi.fn(),
    command: vi.fn((name: string) => ({
      action: vi.fn((callback: RunAction) => {
        if (name.startsWith('resume ')) {
          commandState.resumeAction = callback as unknown as ResumeAction;
          return;
        }

        commandState.runAction = callback;
      }),
    })),
    outputHelp,
    parse,
  }),
}));

import { main } from './cli';

describe('cli', () => {
  beforeEach(() => {
    write.mockReset();
    writeError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it('renders TUI with no args', async () => {
    await main([]);
    expect(mockReset).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith(undefined);
    expect(parse).not.toHaveBeenCalled();
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

  it('calls parse with --help', async () => {
    await main(['--help']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '--help']);
    expect(outputHelp).not.toHaveBeenCalled();
  });

  it('calls parse with --version', async () => {
    await main(['--version']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '--version']);
  });

  it('calls parse with -v', async () => {
    await main(['-v']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '-v']);
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

  it('streams one-off run output with the provided model', async () => {
    streamChat.mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield { type: 'content', content: 'Review complete.' };
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(createSystemMessage).toHaveBeenCalledOnce();
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
            'Tool run_shell result:\npartial output\nError: shell failed',
        },
      ],
      'gemma4',
      ['mock-tool'],
    );
    expect(write).toHaveBeenNthCalledWith(1, 'Tool error handled.');
    expect(write).toHaveBeenNthCalledWith(2, '\n');
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

  it('loads the requested session and renders the TUI for resume', async () => {
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: process.cwd() },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(loadSession).toHaveBeenCalledWith('session-1');
    expect(mockReset).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith('session-1');
    expect(writeError).not.toHaveBeenCalled();
  });

  it('warns when resuming a session from a different directory', async () => {
    loadSession.mockReturnValueOnce({
      metadata: { id: 'session-1', directory: '/other/project' },
      messages: [],
    });

    await commandState.resumeAction?.('session-1');

    expect(writeError).toHaveBeenCalledOnce();
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('/other/project'),
    );
    expect(renderApp).toHaveBeenCalledWith('session-1');
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
