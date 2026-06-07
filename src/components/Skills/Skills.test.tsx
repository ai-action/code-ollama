import { renderWithTheme } from '@/utils/testing';

import { Skills } from './Skills';

const loadSkills = vi.hoisted(() => vi.fn());

const { mockMultiSelectPrompt } = vi.hoisted(() => ({
  mockMultiSelectPrompt:
    vi.fn<
      (props: {
        options: { label: string; value: string }[];
        defaultValue?: string[];
        onSubmit?: (values: string[]) => void;
        onCancel?: () => void;
      }) => void
    >(),
}));

vi.mock('../MultiSelectPrompt', async () => {
  const { Text } = await import('ink');
  return {
    MultiSelectPrompt: (props: {
      options: { label: string; value: string }[];
      defaultValue?: string[];
      onSubmit?: (values: string[]) => void;
      onCancel?: () => void;
    }) => {
      mockMultiSelectPrompt(props);
      return <Text>MultiSelectPrompt</Text>;
    },
    MultiSelectPromptHint: () => null,
  };
});

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
    mockMultiSelectPrompt.mockClear();
    loadSkills.mockReturnValue([]);
  });

  it('renders an empty state when no skills are loaded', () => {
    const { lastFrame } = renderWithTheme(
      <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Skills');
    expect(lastFrame()).toContain('No skills loaded.');
  });

  describe('option label formatting', () => {
    it('omits * for project skills', () => {
      loadSkills.mockReturnValue([
        {
          name: 'My Skill',
          source: 'project',
          content: '',
          path: mockSkillPath,
          isDisabled: false,
        },
      ]);

      renderWithTheme(
        <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
      );

      const [call] = mockMultiSelectPrompt.mock.calls;
      expect(call[0].options[0].label).toBe('My Skill');
    });

    it('appends * for user skills', () => {
      loadSkills.mockReturnValue([
        {
          name: 'My Skill',
          source: 'user',
          content: '',
          path: mockSkillPath,
          isDisabled: false,
        },
      ]);

      renderWithTheme(
        <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
      );

      const [call] = mockMultiSelectPrompt.mock.calls;
      expect(call[0].options[0].label).toBe('My Skill*');
    });

    it('includes description when present', () => {
      loadSkills.mockReturnValue([
        {
          name: 'My Skill',
          source: 'project',
          description: 'Does something useful.',
          content: '',
          path: mockSkillPath,
          isDisabled: false,
        },
      ]);

      renderWithTheme(
        <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
      );

      const [call] = mockMultiSelectPrompt.mock.calls;
      expect(call[0].options[0].label).toBe(
        'My Skill - Does something useful.',
      );
    });

    it('truncates long labels with ellipsis (terminal width 100, chrome 8)', () => {
      const longDescription = 'a'.repeat(100);
      loadSkills.mockReturnValue([
        {
          name: 'My Skill',
          source: 'project',
          description: longDescription,
          content: '',
          path: mockSkillPath,
          isDisabled: false,
        },
      ]);

      renderWithTheme(
        <Skills disabledSkills={[]} onClose={vi.fn()} onSave={vi.fn()} />,
      );

      const [call] = mockMultiSelectPrompt.mock.calls;
      const { label } = call[0].options[0];
      expect(label).toHaveLength(92);
      expect(label).toMatch(/…$/);
    });
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
    expect(lastFrame()).toContain('MultiSelectPrompt');
  });

  it('calls onCancel when MultiSelectPrompt triggers onCancel', () => {
    loadSkills.mockReturnValue([
      {
        name: 'Test Skill',
        source: 'project',
        content: 'Test',
        path: mockSkillPath,
        isDisabled: false,
      },
    ]);

    const onClose = vi.fn();
    renderWithTheme(
      <Skills disabledSkills={[]} onClose={onClose} onSave={vi.fn()} />,
    );

    const [call] = mockMultiSelectPrompt.mock.calls;
    expect(call).toBeDefined();
    call[0].onCancel?.();

    expect(onClose).toHaveBeenCalledOnce();
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

    const [call] = mockMultiSelectPrompt.mock.calls;
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

    const [call] = mockMultiSelectPrompt.mock.calls;
    expect(call).toBeDefined();
    call[0].onSubmit?.([visiblePath1]);

    expect(onSave).toHaveBeenCalledWith({
      disabledSkills: [visiblePath2],
    });
  });
});
