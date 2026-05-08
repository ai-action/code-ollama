import { render } from 'ink-testing-library';

import { MODE } from '../constants';
import { time } from '../utils';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders Safe mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.NAME.SAFE} onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
  });

  it('renders Auto mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.NAME.AUTO} onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
  });

  it('renders Plan mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.NAME.PLAN} onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Plan');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
  });

  it('calls onToggleMode when Shift+Tab is pressed', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer mode={MODE.NAME.SAFE} onToggleMode={mockToggle} />,
    );

    // Send Shift+Tab escape sequence
    stdin.write('\x1B[Z');
    await time.tick();

    expect(mockToggle).toHaveBeenCalled();
  });

  it('does not call onToggleMode for regular key presses', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer mode={MODE.NAME.SAFE} onToggleMode={mockToggle} />,
    );

    // Send a regular Tab (without shift)
    stdin.write('\t');
    await time.tick();

    expect(mockToggle).not.toHaveBeenCalled();
  });
});
