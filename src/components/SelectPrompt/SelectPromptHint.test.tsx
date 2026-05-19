import { render } from 'ink-testing-library';

import { SelectPromptHint } from './SelectPromptHint';

describe('SelectPromptHint', () => {
  it('renders with default message', () => {
    const { lastFrame } = render(<SelectPromptHint />);
    expect(lastFrame()).toContain('Select option');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('Enter');
    expect(lastFrame()).toContain('Esc');
    expect(lastFrame()).toContain('Ctrl+C');
    expect(lastFrame()).toContain('cancel');
  });

  it('renders with custom message', () => {
    const { lastFrame } = render(<SelectPromptHint message="Choose model" />);
    expect(lastFrame()).toContain('Choose model');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('Enter');
  });

  it('renders with custom escape label', () => {
    const { lastFrame } = render(<SelectPromptHint escapeLabel="go back" />);
    expect(lastFrame()).toContain('go back');
    expect(lastFrame()).not.toContain('cancel');
  });

  it('renders with both custom message and escape label', () => {
    const { lastFrame } = render(
      <SelectPromptHint message="Select file" escapeLabel="abort" />,
    );
    expect(lastFrame()).toContain('Select file');
    expect(lastFrame()).toContain('abort');
  });
});
