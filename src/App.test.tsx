import { render } from 'ink-testing-library';

import App from './App';

describe('App', () => {
  it('renders', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('code-ollama');
  });
});
