import { homedir } from 'node:os';

import { render } from 'ink-testing-library';

import { PACKAGE, UI } from '@/constants';

import { Header } from './Header';

describe('Header', () => {
  it('renders title with prefix and version', () => {
    const { lastFrame } = render(<Header model="gemma4" onLoad={vi.fn()} />);
    expect(lastFrame()).toContain(
      `${UI.HEADER_PREFIX}Code Ollama (v${PACKAGE.VERSION})`,
    );
  });

  it('renders model', () => {
    const { lastFrame } = render(<Header model="llama3" onLoad={vi.fn()} />);
    expect(lastFrame()).toContain('llama3');
  });

  it('renders /model hint', () => {
    const { lastFrame } = render(<Header model="gemma4" onLoad={vi.fn()} />);
    expect(lastFrame()).toContain('/model to manage');
  });

  it('renders directory abbreviated with ~', () => {
    const { lastFrame } = render(<Header model="gemma4" onLoad={vi.fn()} />);
    const expected = process.cwd().replace(homedir(), '~');
    expect(lastFrame()).toContain(expected);
  });

  it('renders directory as-is when not under home dir', () => {
    const spy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/other');
    const { lastFrame } = render(<Header model="gemma4" onLoad={vi.fn()} />);
    expect(lastFrame()).toContain('/tmp/other');
    spy.mockRestore();
  });
});
