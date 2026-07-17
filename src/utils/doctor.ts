import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG } from '@/constants';

import { loadConfig, loadHostConfig } from './config';
import { checkHealth, listModels } from './ollama';

export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
  detail?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
}

const CONNECTION_TIMEOUT_MS = 3_000;
const CONFIG_PATH = join(CONFIG.DIRECTORY, 'config.json');

function checkConfig(): DoctorCheck {
  if (!existsSync(CONFIG_PATH)) {
    return {
      name: 'Configuration',
      status: 'pass',
      message: 'Not found (using defaults)',
    };
  }

  try {
    const value: unknown = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return {
        name: 'Configuration',
        status: 'fail',
        message: 'Config must contain a JSON object',
      };
    }

    return {
      name: 'Configuration',
      status: 'pass',
      message: 'Valid',
      detail: CONFIG_PATH,
    };
  } catch {
    return {
      name: 'Configuration',
      status: 'fail',
      message: `Malformed JSON (${CONFIG_PATH})`,
    };
  }
}

async function checkConnectivity(host: string): Promise<DoctorCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CONNECTION_TIMEOUT_MS);

  try {
    const reachable = await checkHealth(host, controller.signal);
    return reachable
      ? { name: 'Ollama connection', status: 'pass', message: 'Reachable' }
      : { name: 'Ollama connection', status: 'fail', message: 'Unreachable' };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        name: 'Ollama connection',
        status: 'fail',
        message: `Timed out after ${String(CONNECTION_TIMEOUT_MS / 1_000)}s`,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function skippedModelChecks(): DoctorCheck[] {
  return [
    {
      name: 'Installed models',
      status: 'skip',
      message: 'Skipped because Ollama is unreachable',
    },
    {
      name: 'Configured model',
      status: 'skip',
      message: 'Skipped because Ollama is unreachable',
    },
  ];
}

export async function runDoctor(): Promise<DoctorReport> {
  const configCheck = checkConfig();
  const hostConfig = loadHostConfig();
  const config = loadConfig();
  const hostCheck: DoctorCheck = {
    name: 'Ollama host',
    status: 'pass',
    message: hostConfig.effectiveHost,
    detail: hostConfig.source,
  };
  const connectivityCheck = await checkConnectivity(hostConfig.effectiveHost);

  const checks = [configCheck, hostCheck, connectivityCheck];
  if (connectivityCheck.status === 'fail') {
    checks.push(...skippedModelChecks());
    return { checks };
  }

  const models = await listModels();
  checks.push({
    name: 'Installed models',
    status: models.length > 0 ? 'pass' : 'warn',
    message:
      models.length > 0
        ? `${String(models.length)} installed`
        : 'No models installed',
    ...(models.length > 0 ? { detail: models.join(', ') } : {}),
  });

  const configuredModel =
    typeof config.model === 'string' ? config.model : undefined;
  if (!configuredModel) {
    checks.push({
      name: 'Configured model',
      status: 'warn',
      message: 'No model configured',
    });
  } else if (models.includes(configuredModel)) {
    checks.push({
      name: 'Configured model',
      status: 'pass',
      message: `${configuredModel} is installed`,
    });
  } else {
    checks.push({
      name: 'Configured model',
      status: 'fail',
      message: `${configuredModel} is not installed`,
    });
  }

  return { checks };
}
