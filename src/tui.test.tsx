const { render } = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock('ink', () => ({
  render,
}));

vi.mock('./components', () => ({
  App: () => null,
}));

import { renderApp } from './tui';

describe('tui', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the App component', () => {
    renderApp();
    expect(render).toHaveBeenCalledOnce();
  });
});
