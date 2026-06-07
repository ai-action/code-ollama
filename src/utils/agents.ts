import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROMPT, ROLE } from '@/constants';

import { loadConfig } from './config';
import type { Message } from './ollama';
import { formatSkillsForPrompt, loadSkills } from './skills';

const AGENTS_FILE = 'AGENTS.md';

function loadAgentsContent(): string | null {
  const cwd = process.cwd();
  const agentsPath = join(cwd, AGENTS_FILE);

  if (!existsSync(agentsPath)) {
    return null;
  }

  try {
    return readFileSync(agentsPath, 'utf8');
  } catch {
    return null;
  }
}

export function buildSystemPrompt(): string {
  const parts: string[] = [PROMPT.BASE_SYSTEM_PROMPT];

  const agentsContent = loadAgentsContent();
  if (agentsContent) {
    parts.push('\n\nProject context from AGENTS.md:\n', agentsContent);
  }

  const config = loadConfig();
  const allSkills = loadSkills({ disabledSkills: config.disabledSkills });
  const enabledSkills = allSkills.filter((skill) => !skill.isDisabled);
  const skillsContent = formatSkillsForPrompt(enabledSkills);

  if (skillsContent) {
    parts.push('\n\n', skillsContent);
  }

  parts.push('\n\n', PROMPT.TOOL_INSTRUCTIONS);

  return parts.join('');
}

let systemMessage: Message | null = null;

export function createSystemMessage(): Message {
  return {
    role: ROLE.SYSTEM,
    content: buildSystemPrompt(),
  };
}

export function resetSystemMessage(): void {
  systemMessage = null;
}

export function withSystemMessage(messages: Message[]) {
  systemMessage ??= createSystemMessage();
  return [systemMessage, ...messages];
}
