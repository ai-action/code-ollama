import { render } from 'ink-testing-library';

import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders markdown content', () => {
    const { lastFrame } = render(<Markdown content="# Hello" />);
    expect(lastFrame()).toContain('Hello');
  });

  it('renders plain text', () => {
    const { lastFrame } = render(<Markdown content="Hello world" />);
    expect(lastFrame()).toContain('Hello world');
  });

  it('applies color prop', () => {
    const { lastFrame } = render(<Markdown content="text" color="blue" />);
    expect(lastFrame()).toContain('text');
  });

  it('handles component unmount (cleanup)', () => {
    const { unmount, lastFrame } = render(<Markdown content="test" />);
    expect(lastFrame()).toContain('test');
    unmount();
  });
});
