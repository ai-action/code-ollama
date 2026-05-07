const { render } = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock('ink', () => ({
  render,
}));

vi.mock('./utils', () => ({
  screen: {
    setClearHandler: vi.fn(),
  },
}));

vi.mock('./components', () => ({
  App: () => null,
}));

import { renderApp } from './tui';
import { screen } from './utils';

describe('tui', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the App component', () => {
    const clear = vi.fn();
    vi.mocked(render).mockReturnValue({ clear } as ReturnType<typeof render>);

    renderApp();

    expect(render).toHaveBeenCalledOnce();
    expect(screen.setClearHandler).toHaveBeenCalledWith(expect.any(Function));

    const handler = vi.mocked(screen.setClearHandler).mock.calls[0]?.[0];
    handler?.();
    expect(clear).toHaveBeenCalledOnce();
  });
});
