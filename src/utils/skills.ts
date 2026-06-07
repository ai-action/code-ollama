import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { CONFIG } from '@/constants';

export enum SkillSource {
  Project = 'project',
  User = 'user',
}

export interface Skill {
  name: string;
  source: SkillSource;
  description?: string;
  content: string;
  path: string;
  isDisabled: boolean;
}

interface LoadSkillsOptions {
  projectSkillsDirectory?: string;
  userSkillsDirectory?: string;
  disabledSkills?: string[];
}

const PROJECT_SKILLS_DIRECTORY = join('.code-ollama', 'skills');
const USER_SKILLS_DIRECTORY = join(CONFIG.DIRECTORY, 'skills');
const SKILL_FILE = 'SKILL.md';

function parseFrontmatter(content: string): {
  metadata: { name?: string; description?: string };
  body: string;
} {
  if (!content.startsWith('---\n')) {
    return { metadata: {}, body: content };
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return { metadata: {}, body: content };
  }

  const metadata: { name?: string; description?: string } = {};
  const frontmatter = content.slice(4, endIndex);

  for (const line of frontmatter.split('\n')) {
    const match = /^(name|description):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    const key = match[1] as 'name' | 'description';
    const value = match[2];
    const normalizedValue = value.trim().replace(/^["']|["']$/g, '');
    if (normalizedValue) {
      metadata[key] = normalizedValue;
    }
  }

  return {
    metadata,
    body: content.slice(endIndex + 5).replace(/^\n/, ''),
  };
}

function loadSkillsFromDirectory(
  directory: string,
  source: SkillSource,
  disabledSkills: string[],
): Skill[] {
  if (!existsSync(directory)) {
    return [];
  }

  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) => {
        try {
          const skillPath = resolve(directory, entry.name);
          const content = readFileSync(
            join(directory, entry.name, SKILL_FILE),
            'utf8',
          );
          const { body, metadata } = parseFrontmatter(content);

          return [
            {
              name: metadata.name ?? entry.name,
              source,
              ...(metadata.description
                ? { description: metadata.description }
                : {}),
              content: body,
              path: skillPath,
              isDisabled: disabledSkills.includes(skillPath),
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
  const disabledSkills = options.disabledSkills ?? [];

  return [
    ...loadSkillsFromDirectory(
      projectSkillsDirectory,
      SkillSource.Project,
      disabledSkills,
    ),
    ...loadSkillsFromDirectory(
      userSkillsDirectory,
      SkillSource.User,
      disabledSkills,
    ),
  ];
}

export function formatSkillsForPrompt(skills: Skill[]): string | null {
  if (!skills.length) {
    return null;
  }

  return [
    'Loaded skills:',
    'These are additional instructions. Follow any skill when it applies to the user request.',
    'Do not invent skill capabilities or descriptions. If the user asks what skills are loaded or what a skill says, answer only from the names, sources, and contents below.',
    ...skills.map(({ content, description, name, source }) =>
      [
        `--- Skill: ${name} (${source}) ---`,
        description ? `Description: ${description}` : '',
        content.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n\n');
}
