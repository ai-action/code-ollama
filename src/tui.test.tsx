const { render } = vi.hoisted(() => ({
  render: vi.fn(),
}));

const closeMcpClients = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('ink', () => ({
  render,
}));

vi.mock('./utils', () => ({
  mcp: {
    closeMcpClients,
  },
  screen: {
    setClearHandler: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('./components', () => ({
  App: () => null,
}));

import { INK } from './constants';
import { renderApp } from './tui';
import { screen } from './utils';

describe('tui', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the App component and closes MCP clients after Ink exits', async () => {
    const rerender = vi.fn();
    let resolveExit: (() => void) | undefined;
    const waitUntilExit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExit = resolve;
        }),
    );
    vi.mocked(render).mockReturnValue({
      rerender,
      waitUntilExit,
    } as ReturnType<typeof render>);

    renderApp();

    expect(render).toHaveBeenCalledWith(expect.anything(), INK.RENDER_OPTIONS);
    expect(screen.setClearHandler).toHaveBeenCalledWith(expect.any(Function));

    const handler = vi.mocked(screen.setClearHandler).mock.calls[0]?.[0];
    handler?.();
    expect(screen.reset).toHaveBeenCalledOnce();
    expect(rerender).toHaveBeenCalledWith(expect.anything());
    expect(closeMcpClients).not.toHaveBeenCalled();

    resolveExit?.();
    await waitUntilExit.mock.results[0]?.value;
    await Promise.resolve();

    expect(closeMcpClients).toHaveBeenCalledOnce();
  });
});
