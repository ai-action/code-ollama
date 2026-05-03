import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.code-ollama');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  host: 'http://localhost:11434',
  model: 'gemma4',
} as const;

export interface Config {
  host: string;
  model: string;
}

function readFile(): Partial<Config> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<Config>;
  } catch {
    return {};
  }
}

export function loadConfig(): Config {
  const file = readFile();
  return {
    host: process.env.OLLAMA_HOST ?? file.host ?? DEFAULTS.host,
    model: process.env.OLLAMA_MODEL ?? file.model ?? DEFAULTS.model,
  };
}

export function saveConfig(patch: Partial<Config>): void {
  const current = readFile();
  const updated = { ...current, ...patch };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
}
