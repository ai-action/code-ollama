import { renderWithTheme } from '@/utils/testing';

import { MultiSelectPromptHint } from './MultiSelectPromptHint';

describe('MultiSelectPromptHint', () => {
  it('renders with default message', () => {
    const { lastFrame } = renderWithTheme(<MultiSelectPromptHint />);
    expect(lastFrame()).toContain('Space to toggle');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
    expect(lastFrame()).toContain('Ctrl+C');
    expect(lastFrame()).toContain('cancel');
  });

  it('renders with custom escape label', () => {
    const { lastFrame } = renderWithTheme(
      <MultiSelectPromptHint escapeLabel="go back" />,
    );
    expect(lastFrame()).toContain('go back');
  });
});
