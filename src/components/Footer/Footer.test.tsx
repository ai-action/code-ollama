import { MODE } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { Footer } from './Footer';

describe('Footer', () => {
  it.each([
    [MODE.SAFE, MODE.LABEL[MODE.SAFE]],
    [MODE.AUTO, MODE.LABEL[MODE.AUTO]],
    [MODE.PLAN, MODE.LABEL[MODE.PLAN]],
  ] as const)('renders %s mode', (mode, label) => {
    const { lastFrame } = renderWithTheme(
      <Footer mode={mode} model="llama3" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain(label);
    expect(lastFrame()).toContain('Shift+Tab to toggle');
    expect(lastFrame()).toContain('Model:');
    expect(lastFrame()).toContain('llama3');
    expect(lastFrame()).toContain('? shortcuts');
  });

  it('calls onToggleMode when Shift+Tab is pressed', async () => {
    const mockToggle = vi.fn();
    const { stdin } = renderWithTheme(
      <Footer mode={MODE.SAFE} model="llama3" onToggleMode={mockToggle} />,
    );

    // Send Shift+Tab escape sequence
    stdin.write('\x1B[Z');
    await time.tick();

    expect(mockToggle).toHaveBeenCalled();
  });

  it('does not call onToggleMode for regular key presses', async () => {
    const mockToggle = vi.fn();
    const { stdin } = renderWithTheme(
      <Footer mode={MODE.SAFE} model="llama3" onToggleMode={mockToggle} />,
    );

    // Send a regular Tab (without shift)
    stdin.write('\t');
    await time.tick();

    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('renders "not configured" when model is empty', () => {
    const { lastFrame } = renderWithTheme(
      <Footer mode={MODE.SAFE} model="" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('not configured');
  });
});
