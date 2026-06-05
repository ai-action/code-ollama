import { realpathSync } from 'node:fs';

import { loadConfig, saveConfig } from './config';

export function getCurrentDirectory(): string {
  return realpathSync(process.cwd());
}

export function isDirectoryTrusted(directory = getCurrentDirectory()): boolean {
  return loadConfig().trustedDirectories?.includes(directory) ?? false;
}

export function trustDirectory(directory = getCurrentDirectory()): void {
  const current = loadConfig().trustedDirectories ?? [];

  if (current.includes(directory)) {
    return;
  }

  saveConfig({
    trustedDirectories: [...current, directory],
  });
}
