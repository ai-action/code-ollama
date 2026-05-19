import { render } from 'ink-testing-library';

import { ExitHint } from './ExitHint';

describe('ExitHint', () => {
  it('renders with default action', () => {
    const { lastFrame } = render(<ExitHint />);
    expect(lastFrame()).toContain('Press Esc or Ctrl+C to go back.');
  });

  it('renders with custom action', () => {
    const { lastFrame } = render(<ExitHint action="cancel" />);
    expect(lastFrame()).toContain('Press Esc or Ctrl+C to cancel.');
    expect(lastFrame()).not.toContain('go back');
  });
});
