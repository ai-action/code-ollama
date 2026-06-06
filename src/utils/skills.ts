import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { CONFIG } from '@/constants';

export type SkillSource = 'project' | 'user';

export interface Skill {
  name: string;
  source: SkillSource;
  content: string;
}

interface LoadSkillsOptions {
  projectSkillsDirectory?: string;
  userSkillsDirectory?: string;
}

const PROJECT_SKILLS_DIRECTORY = join('.code-ollama', 'skills');
const USER_SKILLS_DIRECTORY = join(CONFIG.DIRECTORY, 'skills');

function loadSkillsFromDirectory(
  directory: string,
  source: SkillSource,
): Skill[] {
  if (!existsSync(directory)) {
    return [];
  }

  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) => {
        try {
          return [
            {
              name: basename(entry.name, '.md'),
              source,
              content: readFileSync(join(directory, entry.name), 'utf8'),
            },
          ];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function loadSkills(options: LoadSkillsOptions = {}): Skill[] {
  const projectSkillsDirectory =
    options.projectSkillsDirectory ?? PROJECT_SKILLS_DIRECTORY;
  const userSkillsDirectory =
    options.userSkillsDirectory ?? USER_SKILLS_DIRECTORY;

  return [
    ...loadSkillsFromDirectory(projectSkillsDirectory, 'project'),
    ...loadSkillsFromDirectory(userSkillsDirectory, 'user'),
  ];
}

export function formatSkillsForPrompt(skills: Skill[]): string | null {
  if (!skills.length) {
    return null;
  }

  return [
    'Available skills:',
    ...skills.map(({ content, name, source }) =>
      [`--- Skill: ${name} (${source}) ---`, content.trim()].join('\n'),
    ),
  ].join('\n\n');
}
