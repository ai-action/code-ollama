import type { MockInstance } from 'vitest';

type RunAction = (model: string, prompt: string) => Promise<void>;

const {
  clearScreen,
  createSystemMessage,
  executeTool,
  outputHelp,
  parse,
  renderApp,
  streamChat,
} = vi.hoisted(() => ({
  clearScreen: vi.fn(),
  createSystemMessage: vi.fn(() => ({
    role: 'system',
    content: 'system prompt',
  })),
  executeTool: vi.fn(),
  outputHelp: vi.fn(),
  parse: vi.fn(),
  renderApp: vi.fn(),
  streamChat: vi.fn(),
}));

const commandState = vi.hoisted(() => ({
  runAction: null as RunAction | null,
}));

vi.mock('./utils', () => ({
  agents: { createSystemMessage },
  ollama: { streamChat },
  screen: { clear: clearScreen },
  tools: { TOOLS: ['mock-tool'], executeTool },
}));
vi.mock('./tui', () => ({ renderApp }));

vi.mock('cac', () => ({
  default: () => ({
    version: vi.fn(),
    help: vi.fn(),
    command: vi.fn(() => ({
      action: vi.fn((callback: RunAction) => {
        commandState.runAction = callback;
      }),
    })),
    outputHelp,
    parse,
  }),
}));

import { main } from './cli';

describe('cli', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('renders TUI with no args', async () => {
    await main([]);
    expect(clearScreen).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
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
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Review complete.');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, '\n');
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
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Diff reviewed.');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, '\n');
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
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Tool error handled.');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, '\n');
  });

  it('reports run errors and sets exit code', async () => {
    streamChat.mockImplementationOnce(async function* () {
      await Promise.resolve();
      throw new Error('Ollama unavailable');
      yield { type: 'content', content: '' };
    });

    await commandState.runAction?.('gemma4', 'review diff');

    expect(stderrSpy).toHaveBeenCalledWith('Error: Ollama unavailable\n');
    expect(process.exitCode).toBe(1);
  });
});
