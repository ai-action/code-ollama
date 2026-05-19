import { render } from 'ink-testing-library';

import { MODE } from '@/constants';
import { time } from '@/utils';

import { Footer } from './Footer';

describe('Footer', () => {
  it('renders Safe mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.SAFE} model="llama3" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
    expect(lastFrame()).toContain('Model:');
    expect(lastFrame()).toContain('llama3');
  });

  it('renders Auto mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.AUTO} model="llama3" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
    expect(lastFrame()).toContain('Model:');
    expect(lastFrame()).toContain('llama3');
  });

  it('renders Plan mode', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.PLAN} model="llama3" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Mode:');
    expect(lastFrame()).toContain('Plan');
    expect(lastFrame()).toContain('Shift+Tab to toggle');
    expect(lastFrame()).toContain('Model:');
    expect(lastFrame()).toContain('llama3');
  });

  it('calls onToggleMode when Shift+Tab is pressed', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer mode={MODE.SAFE} model="llama3" onToggleMode={mockToggle} />,
    );

    // Send Shift+Tab escape sequence
    stdin.write('\x1B[Z');
    await time.tick();

    expect(mockToggle).toHaveBeenCalled();
  });

  it('does not call onToggleMode for regular key presses', async () => {
    const mockToggle = vi.fn();
    const { stdin } = render(
      <Footer mode={MODE.SAFE} model="llama3" onToggleMode={mockToggle} />,
    );

    // Send a regular Tab (without shift)
    stdin.write('\t');
    await time.tick();

    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('renders "not configured" when model is empty', () => {
    const { lastFrame } = render(
      <Footer mode={MODE.SAFE} model="" onToggleMode={vi.fn()} />,
    );
    expect(lastFrame()).toContain('not configured');
  });
});
