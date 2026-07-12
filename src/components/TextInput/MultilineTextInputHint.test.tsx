import { renderWithTheme } from '@/utils/testing';

import { MultilineTextInputHint } from './MultilineTextInputHint';

describe('MultilineTextInputHint', () => {
  it('renders multiline input shortcuts', () => {
    const { lastFrame } = renderWithTheme(<MultilineTextInputHint />);

    expect(lastFrame()).toContain('Enter newline');
    expect(lastFrame()).toContain('Ctrl+S save');
    expect(lastFrame()).toContain(
      'Enter newline, Ctrl+S save, Esc/Ctrl+C cancel',
    );
  });
});
