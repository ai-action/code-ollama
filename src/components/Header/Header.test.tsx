import { homedir } from 'node:os';

import { PACKAGE, UI } from '@/constants';
import { renderWithTheme } from '@/utils/testing';

import { Header } from './Header';

describe('Header', () => {
  it('renders header content with title, model, and hints', () => {
    const { lastFrame } = renderWithTheme(<Header model="gemma4" />);
    expect(lastFrame()).toContain(
      `${UI.HEADER_PREFIX}Code Ollama (v${PACKAGE.VERSION})`,
    );
    expect(lastFrame()).toContain('gemma4');
    expect(lastFrame()).toContain('/model to manage');
  });

  it('renders directory with home abbreviation or as-is', () => {
    const { lastFrame } = renderWithTheme(<Header model="gemma4" />);
    const abbreviated = process.cwd().replace(homedir(), '~');
    expect(lastFrame()).toContain(abbreviated);

    const spy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/other');
    const { lastFrame: nonHomeFrame } = renderWithTheme(
      <Header model="gemma4" />,
    );
    expect(nonHomeFrame()).toContain('/tmp/other');
    spy.mockRestore();
  });

  it('renders "not configured" when model is empty', () => {
    const { lastFrame } = renderWithTheme(<Header model="" />);
    expect(lastFrame()).toContain('not configured');
  });
});
