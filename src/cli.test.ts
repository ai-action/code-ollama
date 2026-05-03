import { type MockInstance, vi } from 'vitest';

const { outputHelp, parse, render } = vi.hoisted(() => ({
  outputHelp: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock('ink', () => ({ render }));

vi.mock('cac', () => ({
  default: () => ({
    version: vi.fn(),
    help: vi.fn(),
    outputHelp,
    parse,
  }),
}));

import { main } from './cli';

describe('cli', () => {
  let stdoutSpy: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    stdoutSpy.mockRestore();
  });

  it('renders TUI with no args', () => {
    main([]);
    expect(render).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });

  it('calls parse with --help', () => {
    main(['--help']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '--help']);
    expect(outputHelp).not.toHaveBeenCalled();
  });

  it('calls parse with --version', () => {
    main(['--version']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '--version']);
  });

  it('calls parse with -v', () => {
    main(['-v']);
    expect(parse).toHaveBeenCalledWith(['node', 'code-ollama', '-v']);
  });
});
