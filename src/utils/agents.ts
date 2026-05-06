import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROMPT, ROLE } from '../constants';
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
  const parts: string[] = [PROMPT.BASE_SYSTEM_PROMPT];

  const agentsContent = loadAgentsContent();
  if (agentsContent) {
    parts.push('\n\nProject context from AGENTS.md:\n', agentsContent);
  }

  parts.push('\n\n', PROMPT.TOOL_INSTRUCTIONS);

  return parts.join('');
}

export function createSystemMessage(): ollama.Message {
  return {
    role: ROLE.SYSTEM,
    content: buildSystemPrompt(),
  };
}
