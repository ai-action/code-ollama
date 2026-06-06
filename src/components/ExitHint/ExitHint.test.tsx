import { renderWithTheme } from '@/utils/testing';

import { ExitHint } from './ExitHint';

describe('ExitHint', () => {
  it('renders with default action', () => {
    const { lastFrame } = renderWithTheme(<ExitHint />);
    expect(lastFrame()).toContain('Press Esc/Ctrl+C to go back.');
  });

  it('renders with custom action', () => {
    const { lastFrame } = renderWithTheme(<ExitHint action="cancel" />);
    expect(lastFrame()).toContain('Press Esc/Ctrl+C to cancel.');
    expect(lastFrame()).not.toContain('go back');
  });
});
