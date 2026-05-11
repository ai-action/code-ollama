import { render } from 'ink-testing-library';

import { UI } from '../../constants';
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

  it('clamps horizontal rules to terminal width', () => {
    const content = ['before', '', '---', '', 'after'].join('\n');
    const { lastFrame } = render(<Markdown content={content} />);
    const frame = lastFrame() ?? '';
    // ink-testing-library uses 100 columns; available = 100 - 4 margin = 96
    const expectedHr = UI.MARKDOWN_HR_CHARACTER.repeat(96);
    expect(frame).toContain(expectedHr);
    expect(frame).not.toContain(expectedHr + UI.MARKDOWN_HR_CHARACTER);
  });

  it('handles component unmount (cleanup)', () => {
    const { unmount, lastFrame } = render(<Markdown content="test" />);
    expect(lastFrame()).toContain('test');
    unmount();
  });

  it('converts $\\rightarrow$ to →', () => {
    const { lastFrame } = render(<Markdown content="A $\\rightarrow$ B" />);
    expect(lastFrame()).not.toContain('$\\rightarrow$');
  });

  it('converts $\\$$ to $', () => {
    const { lastFrame } = render(<Markdown content="price: $\\$$" />);
    expect(lastFrame()).not.toContain('$\\$$');
  });

  it('converts $\\%$ to %', () => {
    const { lastFrame } = render(<Markdown content="rate: $\\%$" />);
    expect(lastFrame()).not.toContain('$\\%$');
  });

  it('converts multiple LaTeX commands in one line', () => {
    const { lastFrame } = render(
      <Markdown content="$\\alpha$ $\\leq$ $\\infty$" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('$\\alpha$');
    expect(frame).not.toContain('$\\leq$');
    expect(frame).not.toContain('$\\infty$');
  });
});
