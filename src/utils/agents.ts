import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROLE } from '../constants';
import { BASE_SYSTEM_PROMPT, TOOL_INSTRUCTIONS } from '../constants/prompt';
import type * as ollama from './ollama';

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
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  const agentsContent = loadAgentsContent();
  if (agentsContent) {
    parts.push('\n\nProject context from AGENTS.md:\n', agentsContent);
  }

  parts.push('\n\n', TOOL_INSTRUCTIONS);

  return parts.join('');
}

export function createSystemMessage(): ollama.Message {
  return {
    role: ROLE.SYSTEM,
    content: buildSystemPrompt(),
  };
}
