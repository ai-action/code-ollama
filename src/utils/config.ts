import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PACKAGE } from '../constants';
import type { Config } from '../types';

const CONFIG_DIRECTORY = join(homedir(), `.${PACKAGE.NAME}`);
const CONFIG_PATH = join(CONFIG_DIRECTORY, 'config.json');

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'gemma4';

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
    model: process.env.OLLAMA_MODEL ?? file.model ?? DEFAULT_MODEL,
    searxngBaseUrl: file.searxngBaseUrl,
  };
}

export function saveConfig(patch: Partial<Config>): void {
  const current = readFile();
  const updated = {
    ...current,
    ...patch,
  };

  mkdirSync(CONFIG_DIRECTORY, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
}
