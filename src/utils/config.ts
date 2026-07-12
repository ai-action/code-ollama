import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG, THEME } from '@/constants';
import type { Config } from '@/types';

const CONFIG_PATH = join(CONFIG.DIRECTORY, 'config.json');

const DEFAULT_HOST = 'http://localhost:11434';

export interface HostConfig {
  configuredHost?: string;
  effectiveHost: string;
  source: 'default' | 'environment' | 'file';
}

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

  const { effectiveHost } = resolveHost(file.host);

  return {
    host: effectiveHost,
    model: file.model,
    mcpServers: file.mcpServers,
    searxngBaseUrl: file.searxngBaseUrl,
    theme: file.theme ?? THEME.DEFAULT_THEME_ID,
    trustedDirectories: file.trustedDirectories,
    disabledSkills: file.disabledSkills ?? [],
  };
}

export function loadHostConfig(): HostConfig {
  const file = readFile();
  return {
    configuredHost: file.host,
    ...resolveHost(file.host),
  };
}

function resolveHost(configuredHost?: string) {
  if (process.env.OLLAMA_HOST !== undefined) {
    return {
      effectiveHost: process.env.OLLAMA_HOST,
      source: 'environment' as const,
    };
  }

  if (configuredHost !== undefined) {
    return { effectiveHost: configuredHost, source: 'file' as const };
  }

  return { effectiveHost: DEFAULT_HOST, source: 'default' as const };
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
