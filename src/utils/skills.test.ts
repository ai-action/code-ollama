import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { formatSkillsForPrompt, loadSkills, SkillSource } from './skills';

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'code-ollama-skills-'));
}

function writeSkill(directory: string, name: string, content: string): string {
  const skillDirectory = join(directory, name);
  mkdirSync(skillDirectory);
  writeFileSync(join(skillDirectory, 'SKILL.md'), content);
  return skillDirectory;
}

describe('skills', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempRoot();
  });

  afterEach(() => {
    rmSync(tempRoot, { force: true, recursive: true });
  });

  it('returns an empty list when skill directories are missing', () => {
    expect(
      loadSkills({
        projectSkillsDirectory: join(tempRoot, 'project'),
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([]);
  });

  it('loads project skills before user skills', () => {
    const projectDirectory = join(tempRoot, 'project');
    const userDirectory = join(tempRoot, 'user');
    mkdirSync(projectDirectory);
    mkdirSync(userDirectory);
    writeSkill(projectDirectory, 'review', 'Project review');
    writeSkill(userDirectory, 'style', 'User style');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: userDirectory,
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        content: 'Project review',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
      {
        name: 'style',
        source: SkillSource.User,
        content: 'User style',
        path: resolve(userDirectory, 'style'),
        isDisabled: false,
      },
    ]);
  });

  it('loads optional frontmatter metadata', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(
      projectDirectory,
      'review',
      [
        '---',
        'name: Code Review',
        'description: Review staged changes carefully.',
        '---',
        '',
        'Review pull requests.',
      ].join('\n'),
    );

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'Code Review',
        source: SkillSource.Project,
        description: 'Review staged changes carefully.',
        content: 'Review pull requests.',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('falls back to filename when frontmatter has no name', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(
      projectDirectory,
      'review',
      ['---', 'description: Review code.', '---', '', 'Review code.'].join(
        '\n',
      ),
    );

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        description: 'Review code.',
        content: 'Review code.',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('sorts skills by filename within each source', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(projectDirectory, 'zebra', 'Zebra skill');
    writeSkill(projectDirectory, 'alpha', 'Alpha skill');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'alpha',
        source: SkillSource.Project,
        content: 'Alpha skill',
        path: resolve(projectDirectory, 'alpha'),
        isDisabled: false,
      },
      {
        name: 'zebra',
        source: SkillSource.Project,
        content: 'Zebra skill',
        path: resolve(projectDirectory, 'zebra'),
        isDisabled: false,
      },
    ]);
  });

  it('keeps colliding names from different sources', () => {
    const projectDirectory = join(tempRoot, 'project');
    const userDirectory = join(tempRoot, 'user');
    mkdirSync(projectDirectory);
    mkdirSync(userDirectory);
    writeSkill(projectDirectory, 'review', 'Project review');
    writeSkill(userDirectory, 'review', 'User review');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: userDirectory,
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        content: 'Project review',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
      {
        name: 'review',
        source: SkillSource.User,
        content: 'User review',
        path: resolve(userDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('ignores flat markdown files and directories without SKILL.md', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    mkdirSync(join(projectDirectory, 'missing-skill-file'));
    writeSkill(projectDirectory, 'review', 'Review skill');
    writeFileSync(join(projectDirectory, 'flat.md'), 'Flat skill');
    writeFileSync(join(projectDirectory, 'notes.txt'), 'Notes');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        content: 'Review skill',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('skips unreadable markdown files', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(projectDirectory, 'readable', 'Readable skill');
    const unreadableDirectory = writeSkill(
      projectDirectory,
      'unreadable',
      'Unreadable skill',
    );
    const unreadablePath = join(unreadableDirectory, 'SKILL.md');
    chmodSync(unreadablePath, 0);

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'readable',
        source: SkillSource.Project,
        content: 'Readable skill',
        path: resolve(projectDirectory, 'readable'),
        isDisabled: false,
      },
    ]);
  });

  it('treats content with an unclosed frontmatter delimiter as plain body', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(
      projectDirectory,
      'review',
      ['---', 'name: Code Review', '', 'Review pull requests.'].join('\n'),
    );

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        content: ['---', 'name: Code Review', '', 'Review pull requests.'].join(
          '\n',
        ),
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('ignores frontmatter keys with empty or whitespace-only values', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(
      projectDirectory,
      'review',
      [
        '---',
        'name:   ',
        'description: ""',
        '---',
        '',
        'Review pull requests.',
      ].join('\n'),
    );

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'review',
        source: SkillSource.Project,
        content: 'Review pull requests.',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('ignores unrecognised frontmatter keys', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(
      projectDirectory,
      'review',
      [
        '---',
        'name: Code Review',
        'author: Alice',
        'version: 1',
        '---',
        '',
        'Review pull requests.',
      ].join('\n'),
    );

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      {
        name: 'Code Review',
        source: SkillSource.Project,
        content: 'Review pull requests.',
        path: resolve(projectDirectory, 'review'),
        isDisabled: false,
      },
    ]);
  });

  it('ignores paths that cannot be read as directories', () => {
    const projectPath = join(tempRoot, 'project-file');
    writeFileSync(projectPath, 'not a directory');

    expect(
      loadSkills({
        projectSkillsDirectory: projectPath,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([]);
  });

  it('formats skills for prompt inclusion', () => {
    expect(
      formatSkillsForPrompt([
        {
          name: 'review',
          source: SkillSource.Project,
          description: 'Review staged changes.',
          content: 'Review pull requests\n',
          path: '/test/.code-ollama/skills/review',
          isDisabled: false,
        },
      ]),
    ).toBe(
      [
        'Loaded skills:',
        'These are additional instructions. Follow any skill when it applies to the user request.',
        'Do not invent skill capabilities or descriptions. If the user asks what skills are loaded or what a skill says, answer only from the names, sources, and contents below.',
        '--- Skill: review (project) ---\nDescription: Review staged changes.\nReview pull requests',
      ].join('\n\n'),
    );
  });

  it('returns null when formatting no skills', () => {
    expect(formatSkillsForPrompt([])).toBeNull();
  });

  it('formats a skill without a description', () => {
    expect(
      formatSkillsForPrompt([
        {
          name: 'review',
          source: SkillSource.Project,
          content: 'Review pull requests\n',
          path: '/test/.code-ollama/skills/review',
          isDisabled: false,
        },
      ]),
    ).toBe(
      [
        'Loaded skills:',
        'These are additional instructions. Follow any skill when it applies to the user request.',
        'Do not invent skill capabilities or descriptions. If the user asks what skills are loaded or what a skill says, answer only from the names, sources, and contents below.',
        '--- Skill: review (project) ---\nReview pull requests',
      ].join('\n\n'),
    );
  });

  it('uses default directories when called with no options', () => {
    const skills = loadSkills();
    expect(Array.isArray(skills)).toBe(true);
  });

  it('marks disabled skills with isDisabled flag', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(projectDirectory, 'enabled', 'Enabled skill');
    writeSkill(projectDirectory, 'disabled', 'Disabled skill');

    const disabledPath = resolve(projectDirectory, 'disabled');

    const skills = loadSkills({
      projectSkillsDirectory: projectDirectory,
      userSkillsDirectory: join(tempRoot, 'user'),
      disabledSkills: [disabledPath],
    });

    expect(skills).toHaveLength(2);
    // Skills are sorted alphabetically by name, so 'disabled' comes before 'enabled'
    expect(skills[0].name).toBe('disabled');
    expect(skills[0].isDisabled).toBe(true);
    expect(skills[1].name).toBe('enabled');
    expect(skills[1].isDisabled).toBe(false);
  });

  it('includes path for each skill', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeSkill(projectDirectory, 'test-skill', 'Test skill content');

    const skills = loadSkills({
      projectSkillsDirectory: projectDirectory,
      userSkillsDirectory: join(tempRoot, 'user'),
    });

    expect(skills).toHaveLength(1);
    expect(skills[0].path).toBe(resolve(projectDirectory, 'test-skill'));
  });
});
