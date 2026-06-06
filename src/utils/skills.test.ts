import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
      },
      { name: 'style', source: SkillSource.User, content: 'User style' },
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
      { name: 'alpha', source: SkillSource.Project, content: 'Alpha skill' },
      { name: 'zebra', source: SkillSource.Project, content: 'Zebra skill' },
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
      },
      { name: 'review', source: SkillSource.User, content: 'User review' },
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
      { name: 'review', source: SkillSource.Project, content: 'Review skill' },
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
});
