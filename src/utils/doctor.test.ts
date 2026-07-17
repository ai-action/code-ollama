const {
  checkHealth,
  existsSync,
  listModels,
  loadConfig,
  loadHostConfig,
  readFileSync,
} = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  existsSync: vi.fn(),
  listModels: vi.fn(),
  loadConfig: vi.fn(),
  loadHostConfig: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ existsSync, readFileSync }));
vi.mock('./config', () => ({ loadConfig, loadHostConfig }));
vi.mock('./ollama', () => ({ checkHealth, listModels }));

import { runDoctor } from './doctor';

describe('doctor', () => {
  beforeEach(() => {
    existsSync.mockReturnValue(false);
    readFileSync.mockReturnValue('{}');
    loadConfig.mockReturnValue({ model: undefined });
    loadHostConfig.mockReturnValue({
      configuredHost: undefined,
      effectiveHost: 'http://localhost:11434',
      source: 'default',
    });
    checkHealth.mockResolvedValue(true);
    listModels.mockResolvedValue(['qwen3:latest']);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('reports absent config and the default host', async () => {
    const report = await runDoctor();

    expect(report.checks).toEqual([
      {
        name: 'Configuration',
        status: 'pass',
        message: 'Not found (using defaults)',
      },
      {
        name: 'Ollama host',
        status: 'pass',
        message: 'http://localhost:11434',
        detail: 'default',
      },
      { name: 'Ollama connection', status: 'pass', message: 'Reachable' },
      {
        name: 'Installed models',
        status: 'pass',
        message: '1 installed',
        detail: 'qwen3:latest',
      },
      {
        name: 'Configured model',
        status: 'warn',
        message: 'No model configured',
      },
    ]);
    expect(checkHealth).toHaveBeenCalledWith(
      'http://localhost:11434',
      expect.any(AbortSignal),
    );
  });

  it.each([
    ['file', 'http://remote:11434'],
    ['environment', 'http://environment:11434'],
  ] as const)('reports the %s host source', async (source, effectiveHost) => {
    loadHostConfig.mockReturnValue({ effectiveHost, source });

    const report = await runDoctor();

    expect(report.checks[1]).toEqual({
      name: 'Ollama host',
      status: 'pass',
      message: effectiveHost,
      detail: source,
    });
  });

  it('reports a valid config object and an installed configured model', async () => {
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue('{"model":"qwen3:latest"}');
    loadConfig.mockReturnValue({ model: 'qwen3:latest' });

    const report = await runDoctor();

    expect(report.checks[0]).toMatchObject({
      name: 'Configuration',
      status: 'pass',
    });
    expect(report.checks[0]?.message).toBe('Valid');
    expect(report.checks[0]?.detail).toContain('config.json');
    expect(report.checks.at(-1)).toEqual({
      name: 'Configured model',
      status: 'pass',
      message: 'qwen3:latest is installed',
    });
  });

  it('reports malformed config but continues with fallback values', async () => {
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue('{bad json');

    const report = await runDoctor();

    expect(report.checks[0]?.status).toBe('fail');
    expect(report.checks[0]?.message).toContain('Malformed JSON');
    expect(checkHealth).toHaveBeenCalledOnce();
    expect(listModels).toHaveBeenCalledOnce();
  });

  it.each(['null', '[]', '"text"'])(
    'rejects non-object config %s',
    async (value) => {
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(value);

      const report = await runDoctor();

      expect(report.checks[0]).toEqual({
        name: 'Configuration',
        status: 'fail',
        message: 'Config must contain a JSON object',
      });
    },
  );

  it('skips model checks when Ollama is unreachable', async () => {
    checkHealth.mockResolvedValue(false);

    const report = await runDoctor();

    expect(report.checks.slice(2)).toEqual([
      { name: 'Ollama connection', status: 'fail', message: 'Unreachable' },
      {
        name: 'Installed models',
        status: 'skip',
        message: 'Skipped because Ollama is unreachable',
      },
      {
        name: 'Configured model',
        status: 'skip',
        message: 'Skipped because Ollama is unreachable',
      },
    ]);
    expect(listModels).not.toHaveBeenCalled();
  });

  it('bounds the Ollama connection check with a timeout', async () => {
    vi.useFakeTimers();
    checkHealth.mockImplementation(
      (_host: string, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    const pending = runDoctor();
    await vi.advanceTimersByTimeAsync(3_000);

    const report = await pending;
    expect(report.checks[2]).toEqual({
      name: 'Ollama connection',
      status: 'fail',
      message: 'Timed out after 3s',
    });
    expect(listModels).not.toHaveBeenCalled();
  });

  it('propagates unexpected connection errors', async () => {
    checkHealth.mockRejectedValue(new Error('unexpected'));

    await expect(runDoctor()).rejects.toThrow('unexpected');
  });

  it('warns when no models are installed', async () => {
    listModels.mockResolvedValue([]);

    const report = await runDoctor();

    expect(report.checks[3]).toEqual({
      name: 'Installed models',
      status: 'warn',
      message: 'No models installed',
    });
  });

  it('fails when the configured model is not installed', async () => {
    loadConfig.mockReturnValue({ model: 'missing:latest' });

    const report = await runDoctor();

    expect(report.checks.at(-1)).toEqual({
      name: 'Configured model',
      status: 'fail',
      message: 'missing:latest is not installed',
    });
  });

  it('treats a non-string configured model as unconfigured', async () => {
    loadConfig.mockReturnValue({ model: 42 });

    const report = await runDoctor();

    expect(report.checks.at(-1)).toMatchObject({ status: 'warn' });
  });
});
