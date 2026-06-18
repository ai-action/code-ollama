import { renderWithTheme } from '@/utils/testing';

import { SelectPromptHint } from './SelectPromptHint';

describe('SelectPromptHint', () => {
  it('renders with default props', () => {
    const { lastFrame } = renderWithTheme(<SelectPromptHint />);
    expect(lastFrame()).toContain('Select option');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
    expect(lastFrame()).toContain('Ctrl+C');
    expect(lastFrame()).toContain('cancel');
  });

  it('renders with custom message and escape label', () => {
    const { lastFrame } = renderWithTheme(
      <SelectPromptHint message="Select file" escapeLabel="abort" />,
    );
    expect(lastFrame()).toContain('Select file');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('abort');
    expect(lastFrame()).not.toContain('cancel');
  });
});
