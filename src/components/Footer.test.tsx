import { render } from 'ink-testing-library';

import { tick } from '../utils/test';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders Safe mode when autoExecute is false', () => {
    const { lastFrame } = render(
      <Footer autoExecute={false} onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode: Safe');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
  });

  it('renders Auto mode when autoExecute is true', () => {
    const { lastFrame } = render(
      <Footer autoExecute={true} onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode: Auto');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
  });

  it('calls onToggleMode when Shift+Tab is pressed', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer autoExecute={false} onToggleMode={mockToggle} />,
    );

    // Send Shift+Tab escape sequence
    stdin.write('\x1B[Z');
    await tick();

    expect(mockToggle).toHaveBeenCalled();
  });

  it('does not call onToggleMode for regular key presses', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer autoExecute={false} onToggleMode={mockToggle} />,
    );

    // Send a regular Tab (without shift)
    stdin.write('\t');
    await tick();

    expect(mockToggle).not.toHaveBeenCalled();
  });
});
