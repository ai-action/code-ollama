import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG, THEME } from '@/constants';
import type { Config } from '@/types';

const CONFIG_PATH = join(CONFIG.DIRECTORY, 'config.json');

const DEFAULT_HOST = 'http://localhost:11434';

function readFile(): Partial<Config> {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<Config>;
  } catch {
    return {};
  }
}

export function loadConfig(): Config {
  const file = readFile();

  return {
    host: process.env.OLLAMA_HOST ?? file.host ?? DEFAULT_HOST,
    model: file.model,
    searxngBaseUrl: file.searxngBaseUrl,
    theme: file.theme ?? THEME.DEFAULT_THEME_ID,
    trustedDirectories: file.trustedDirectories,
  };
}

export function saveConfig(patch: Partial<Config>): void {
  const current = readFile();
  const updated = {
    ...current,
    ...patch,
  };

  mkdirSync(CONFIG.DIRECTORY, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
}
