import { render } from 'ink-testing-library';

import { App } from './App';

describe('App', () => {
  it('renders title', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Code Ollama');
  });

  it('renders chat input', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('>');
  });
});
