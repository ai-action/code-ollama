import { existsSync, readFileSync } from 'node:fs';

import { ROLE } from '@/constants';
import { BASE_SYSTEM_PROMPT, TOOL_INSTRUCTIONS } from '@/constants/prompt';

import { type Skill, SkillSource } from './skills';

vi.mock('node:fs');

const loadSkills = vi.hoisted(() => vi.fn<() => Skill[]>(() => []));
const loadConfig = vi.hoisted(() =>
  vi.fn(() => ({ disabledSkills: [] as string[] })),
);

vi.mock('./skills', async () => {
  const actual = await vi.importActual<typeof import('./skills')>('./skills');

  return {
    ...actual,
    loadSkills,
  };
});

vi.mock('./config', () => ({
  loadConfig,
}));

describe('agents', () => {
  beforeEach(() => {
    loadSkills.mockReturnValue([]);
  });

  it('creates system message with base prompt', async () => {
    const { createSystemMessage } = await import('./agents');
    const message = createSystemMessage();

    expect(message.role).toBe(ROLE.SYSTEM);
    expect(message.content).toContain(BASE_SYSTEM_PROMPT);
    expect(message.content).toContain(TOOL_INSTRUCTIONS);
  });

  it('includes AGENTS.md content when available', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('## Test Project\nTest context');

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Project context from AGENTS.md:');
    expect(prompt).toContain('## Test Project');
    expect(prompt).toContain('Test context');
  });

  it('works without AGENTS.md', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    expect(prompt).not.toContain('Project context from AGENTS.md:');
    expect(prompt).toContain(BASE_SYSTEM_PROMPT);
  });

  it('includes loaded skills when available', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    loadConfig.mockReturnValue({ disabledSkills: [] });
    loadSkills.mockReturnValue([
      {
        name: 'review',
        source: SkillSource.Project,
        content: 'Review pull requests',
        path: '/test/.code-ollama/skills/review',
        isDisabled: false,
      },
    ]);

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Loaded skills:');
    expect(prompt).toContain('Do not invent skill capabilities');
    expect(prompt).toContain('--- Skill: review (project) ---');
    expect(prompt).toContain('Review pull requests');
  });

  it('omits skills section when no skills are loaded', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    loadConfig.mockReturnValue({ disabledSkills: [] });

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    expect(prompt).not.toContain('Loaded skills:');
  });

  it('excludes disabled skills from prompt', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const disabledPath = '/test/.code-ollama/skills/disabled';
    const enabledPath = '/test/.code-ollama/skills/enabled';
    loadConfig.mockReturnValue({ disabledSkills: [disabledPath] });
    loadSkills.mockReturnValue([
      {
        name: 'disabled-skill',
        source: SkillSource.Project,
        content: 'Disabled content',
        path: disabledPath,
        isDisabled: true,
      },
      {
        name: 'enabled-skill',
        source: SkillSource.Project,
        content: 'Enabled content',
        path: enabledPath,
        isDisabled: false,
      },
    ]);

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Loaded skills:');
    expect(prompt).toContain('enabled-skill');
    expect(prompt).toContain('Enabled content');
    expect(prompt).not.toContain('disabled-skill');
    expect(prompt).not.toContain('Disabled content');
  });

  it('calls loadSkills with disabledSkills from config', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    loadConfig.mockReturnValue({ disabledSkills: ['/path/to/disabled'] });
    loadSkills.mockReturnValue([]);

    const { buildSystemPrompt } = await import('./agents');
    buildSystemPrompt();

    expect(loadSkills).toHaveBeenCalledWith({
      disabledSkills: ['/path/to/disabled'],
    });
  });

  it('handles read file error gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const { buildSystemPrompt } = await import('./agents');
    const prompt = buildSystemPrompt();

    // Should not include AGENTS.md content when read fails
    expect(prompt).not.toContain('Project context from AGENTS.md:');
    expect(prompt).toContain(BASE_SYSTEM_PROMPT);
  });

  it('prepends a system message without mutating the input array', async () => {
    vi.resetModules();
    vi.mocked(existsSync).mockReturnValue(false);

    const { withSystemMessage } = await import('./agents');
    const messages = [{ role: 'user' as const, content: 'hello' }];

    const result = withSystemMessage(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ role: ROLE.SYSTEM });
    expect(result[1]).toEqual(messages[0]);
    expect(messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('reuses the same system message instance across calls', async () => {
    vi.resetModules();
    vi.mocked(existsSync).mockReturnValue(false);

    const { withSystemMessage } = await import('./agents');

    const first = withSystemMessage([]);
    const second = withSystemMessage([]);

    expect(first[0]).toBe(second[0]);
  });

  it('creates a new system message after resetSystemMessage is called', async () => {
    vi.resetModules();
    vi.mocked(existsSync).mockReturnValue(false);

    const { resetSystemMessage, withSystemMessage } = await import('./agents');

    const first = withSystemMessage([]);
    resetSystemMessage();
    const second = withSystemMessage([]);

    expect(first[0]).not.toBe(second[0]);
    expect(first[0]).toEqual(second[0]);
  });
});
