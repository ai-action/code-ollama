import { renderWithTheme } from '@/utils/testing';

import { Skills } from './Skills';

const loadSkills = vi.hoisted(() => vi.fn());
const inputHandlers: ((
  input: string,
  key: { ctrl?: boolean; escape?: boolean },
) => void)[] = [];

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useInput: (
    handler: (input: string, key: { ctrl?: boolean; escape?: boolean }) => void,
  ) => {
    inputHandlers.push(handler);
  },
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  skills: {
    loadSkills,
  },
}));

describe('Skills', () => {
  beforeEach(() => {
    inputHandlers.length = 0;
    loadSkills.mockReturnValue([]);
  });

  it('renders an empty state when no skills are loaded', () => {
    const { lastFrame } = renderWithTheme(<Skills onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Skills');
    expect(lastFrame()).toContain('No skills loaded.');
  });

  it('renders loaded skills grouped by source', () => {
    loadSkills.mockReturnValue([
      { name: 'review', source: 'project', content: 'Review code' },
      { name: 'style', source: 'user', content: 'Use local style' },
    ]);

    const { lastFrame } = renderWithTheme(<Skills onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Project');
    expect(lastFrame()).toContain('- review');
    expect(lastFrame()).toContain('User');
    expect(lastFrame()).toContain('- style');
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    renderWithTheme(<Skills onClose={onClose} />);

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on ctrl-c', () => {
    const onClose = vi.fn();
    renderWithTheme(<Skills onClose={onClose} />);

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('c', { ctrl: true });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores unrelated keys', () => {
    const onClose = vi.fn();
    renderWithTheme(<Skills onClose={onClose} />);

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('x', {});
    inputHandler?.('x', { ctrl: true });

    expect(onClose).not.toHaveBeenCalled();
  });
});
