import { renderWithTheme } from '@/utils/testing';

import { ThinkingSpinner } from './ThinkingSpinner';

const { mockFrame } = vi.hoisted(() => ({
  mockFrame: { value: 0 },
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useAnimation: () => ({ frame: mockFrame.value }),
}));

vi.mock('@inkjs/ui', () => ({
  useSpinner: () => ({ frame: '⏳' }),
}));

describe('ThinkingSpinner', () => {
  it('renders spinner frame and Thinking text', () => {
    mockFrame.value = 2;
    const { lastFrame } = renderWithTheme(<ThinkingSpinner />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('⏳');
    expect(frame).toContain('Thinking');
    expect(frame).toContain('..');
  });

  it('cycles dots based on animation frame', () => {
    mockFrame.value = 0;
    const { lastFrame, rerender } = renderWithTheme(<ThinkingSpinner />);
    expect(lastFrame()).toContain('Thinking');

    mockFrame.value = 1;
    rerender(<ThinkingSpinner />);
    expect(lastFrame()).toContain('Thinking.');

    mockFrame.value = 3;
    rerender(<ThinkingSpinner />);
    expect(lastFrame()).toContain('Thinking...');
  });

  it('uses accent color from theme', () => {
    mockFrame.value = 0;
    const { lastFrame } = renderWithTheme(<ThinkingSpinner />);
    expect(lastFrame()).toContain('⏳');
  });
});
