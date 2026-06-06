import { exec as execSync, execFile as execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execSync);
export const execFile = promisify(execFileSync);
