import { useStdout } from 'ink';
import { render } from 'ink-testing-library';

import { UI } from '@/constants';

import { Markdown } from './Markdown';

const { mockColumns } = vi.hoisted(() => ({
  mockColumns: {
    value: 100,
  },
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useStdout: vi.fn(() => ({
    stdout: {
      columns: mockColumns.value,
    },
  })),
}));

function setTerminalWidth(columns: number) {
  mockColumns.value = columns;
}

function stripAnsi(value: string | undefined) {
  return value?.replaceAll(new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g'), '');
}

describe('Markdown', () => {
  beforeEach(() => {
    setTerminalWidth(100);
    vi.mocked(useStdout).mockClear();
  });

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

  it('converts \\frac{a}{b} to a/b', () => {
    const { lastFrame } = render(<Markdown content="$\\frac{1}{2}$" />);
    expect(lastFrame()).not.toContain('\\frac');
  });

  it('converts subscript _{...} syntax', () => {
    const { lastFrame } = render(<Markdown content="$x_{0}$" />);
    expect(lastFrame()).not.toContain('_{');
  });

  it('converts superscript ^{...} syntax', () => {
    const { lastFrame } = render(<Markdown content="$x^{2}$" />);
    expect(lastFrame()).not.toContain('^{');
  });

  it('strips \\, thin space', () => {
    const { lastFrame } = render(<Markdown content="$dx \\, dt$" />);
    expect(lastFrame()).not.toContain('\\,');
  });

  it('reflows wrapped markdown lists before Ink wraps ANSI output', () => {
    setTerminalWidth(40);

    const content =
      '4. **Restructure the "Usage" section** to clearly separate **Interactive TUI** from **CLI Commands**.';

    const { lastFrame } = render(<Markdown content={content} />);
    const frame = stripAnsi(lastFrame()) ?? '';

    expect(frame).toContain('CLI');
    expect(frame).toContain('Commands');
    expect(frame).not.toContain('**');
  });
});
