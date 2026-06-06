import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { formatSkillsForPrompt, loadSkills } from './skills';

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'code-ollama-skills-'));
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
    writeFileSync(join(projectDirectory, 'review.md'), 'Project review');
    writeFileSync(join(userDirectory, 'style.md'), 'User style');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: userDirectory,
      }),
    ).toEqual([
      { name: 'review', source: 'project', content: 'Project review' },
      { name: 'style', source: 'user', content: 'User style' },
    ]);
  });

  it('sorts skills by filename within each source', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    writeFileSync(join(projectDirectory, 'zebra.md'), 'Zebra skill');
    writeFileSync(join(projectDirectory, 'alpha.md'), 'Alpha skill');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      { name: 'alpha', source: 'project', content: 'Alpha skill' },
      { name: 'zebra', source: 'project', content: 'Zebra skill' },
    ]);
  });

  it('keeps colliding names from different sources', () => {
    const projectDirectory = join(tempRoot, 'project');
    const userDirectory = join(tempRoot, 'user');
    mkdirSync(projectDirectory);
    mkdirSync(userDirectory);
    writeFileSync(join(projectDirectory, 'review.md'), 'Project review');
    writeFileSync(join(userDirectory, 'review.md'), 'User review');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: userDirectory,
      }),
    ).toEqual([
      { name: 'review', source: 'project', content: 'Project review' },
      { name: 'review', source: 'user', content: 'User review' },
    ]);
  });

  it('ignores non-markdown files and directories', () => {
    const projectDirectory = join(tempRoot, 'project');
    mkdirSync(projectDirectory);
    mkdirSync(join(projectDirectory, 'nested.md'));
    writeFileSync(join(projectDirectory, 'review.md'), 'Review skill');
    writeFileSync(join(projectDirectory, 'notes.txt'), 'Notes');

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([{ name: 'review', source: 'project', content: 'Review skill' }]);
  });

  it('skips unreadable markdown files', () => {
    const projectDirectory = join(tempRoot, 'project');
    const readablePath = join(projectDirectory, 'readable.md');
    const unreadablePath = join(projectDirectory, 'unreadable.md');
    mkdirSync(projectDirectory);
    writeFileSync(readablePath, 'Readable skill');
    writeFileSync(unreadablePath, 'Unreadable skill');
    chmodSync(unreadablePath, 0);

    expect(
      loadSkills({
        projectSkillsDirectory: projectDirectory,
        userSkillsDirectory: join(tempRoot, 'user'),
      }),
    ).toEqual([
      { name: 'readable', source: 'project', content: 'Readable skill' },
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
          source: 'project',
          content: 'Review pull requests\n',
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

  it('returns null when formatting no skills', () => {
    expect(formatSkillsForPrompt([])).toBeNull();
  });
});
