import { renderWithTheme } from '@/utils/testing';

import { Skills } from './Skills';

const loadSkills = vi.hoisted(() => vi.fn());

const { mockMultiSelect } = vi.hoisted(() => ({
  mockMultiSelect:
    vi.fn<
      (props: {
        options: { label: string; value: string }[];
        defaultValue?: string[];
        onSubmit?: (values: string[]) => void;
      }) => void
    >(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    MultiSelect: (props: {
      options: { label: string; value: string }[];
      defaultValue?: string[];
      onSubmit?: (values: string[]) => void;
    }) => {
      mockMultiSelect(props);
      return <Text>MultiSelect</Text>;
    },
  };
});

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

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils');
  return {
    ...actual,
    skills: {
      ...actual.skills,
      loadSkills,
    },
  };
});

describe('Skills', () => {
  const mockSkillPath = '/test/project/.code-ollama/skills/review';

  beforeEach(() => {
    inputHandlers.length = 0;
    mockMultiSelect.mockClear();
    loadSkills.mockReturnValue([]);
  });

  it('renders an empty state when no skills are loaded', () => {
    const { lastFrame } = renderWithTheme(
      <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Skills');
    expect(lastFrame()).toContain('No skills loaded.');
  });

  it('renders loaded skills with instructions', () => {
    loadSkills.mockReturnValue([
      {
        name: 'Code Review',
        source: 'project',
        description: 'Review staged changes.',
        content: 'Review code',
        path: mockSkillPath,
        isDisabled: false,
      },
    ]);

    const { lastFrame } = renderWithTheme(
      <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Skills');
    expect(lastFrame()).toContain(
      'Space to toggle, Enter to save, Esc to cancel',
    );
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Skills disabledSkills={[]} onClose={onClose} onSave={vi.fn()} />,
    );

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on ctrl-c', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Skills disabledSkills={[]} onClose={onClose} onSave={vi.fn()} />,
    );

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('c', { ctrl: true });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close on unrelated input', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Skills disabledSkills={[]} onClose={onClose} onSave={vi.fn()} />,
    );

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('a', {});

    expect(onClose).not.toHaveBeenCalled();
  });

  it('preserves offscreen disabled skills on save', () => {
    const offscreenPath = '/other/project/.code-ollama/skills/other';
    const visiblePath = '/current/project/.code-ollama/skills/visible';

    loadSkills.mockReturnValue([
      {
        name: 'Visible Skill',
        source: 'project',
        content: 'Visible',
        path: visiblePath,
        isDisabled: true,
      },
    ]);

    const onSave = vi.fn();
    renderWithTheme(
      <Skills
        disabledSkills={[offscreenPath, visiblePath]}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const [call] = mockMultiSelect.mock.calls;
    expect(call).toBeDefined();
    call[0].onSubmit?.([]);

    expect(onSave).toHaveBeenCalledWith({
      disabledSkills: expect.arrayContaining([
        offscreenPath,
        visiblePath,
      ]) as string[],
    });
  });

  it('saves only unselected visible skills as disabled', () => {
    const visiblePath1 = '/current/project/.code-ollama/skills/skill-a';
    const visiblePath2 = '/current/project/.code-ollama/skills/skill-b';

    loadSkills.mockReturnValue([
      {
        name: 'Skill A',
        source: 'project',
        content: 'A',
        path: visiblePath1,
        isDisabled: false,
      },
      {
        name: 'Skill B',
        source: 'project',
        content: 'B',
        path: visiblePath2,
        isDisabled: false,
      },
    ]);

    const onSave = vi.fn();
    renderWithTheme(
      <Skills disabledSkills={[]} onClose={vi.fn()} onSave={onSave} />,
    );

    const [call] = mockMultiSelect.mock.calls;
    expect(call).toBeDefined();
    call[0].onSubmit?.([visiblePath1]);

    expect(onSave).toHaveBeenCalledWith({
      disabledSkills: [visiblePath2],
    });
  });
});
