import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { v7 as uuidv7 } from 'uuid';

import { CONFIG, ROLE, UI } from '@/constants';

import type { Message } from './ollama';
import type { OllamaCallStats } from './ollama';

const SESSIONS_DIRECTORY = join(CONFIG.DIRECTORY, 'sessions');
const METADATA_FILE_NAME = 'metadata.json';
const MESSAGES_FILE_NAME = 'messages.jsonl';
const STATS_FILE_NAME = 'stats.json';
const DEFAULT_TITLE = 'New session';
const TITLE_MAX_LENGTH = 80;

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  model: string;
  directory: string;
}

export interface SessionRecord {
  metadata: SessionMetadata;
  messages: Message[];
  stats: SessionStats;
}

export interface ModelStats {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  totalDurationNs: number;
  loadDurationNs: number;
  promptEvalDurationNs: number;
  evalDurationNs: number;
}

export interface SessionStats {
  modelCalls: number;
  promptTokens: number;
  outputTokens: number;
  totalDurationNs: number;
  loadDurationNs: number;
  promptEvalDurationNs: number;
  evalDurationNs: number;
  models: Record<string, ModelStats>;
  lastCall?: OllamaCallStats;
}

function getSessionDirectory(id: string): string {
  return join(SESSIONS_DIRECTORY, id);
}

function getMetadataPath(id: string): string {
  return join(getSessionDirectory(id), METADATA_FILE_NAME);
}

function getMessagesPath(id: string): string {
  return join(getSessionDirectory(id), MESSAGES_FILE_NAME);
}

function getStatsPath(id: string): string {
  return join(getSessionDirectory(id), STATS_FILE_NAME);
}

function createEmptyStats(): SessionStats {
  return {
    modelCalls: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalDurationNs: 0,
    loadDurationNs: 0,
    promptEvalDurationNs: 0,
    evalDurationNs: 0,
    models: {},
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isModelStats(value: unknown): value is ModelStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stats = value as Partial<ModelStats>;
  return (
    isFiniteNumber(stats.calls) &&
    isFiniteNumber(stats.promptTokens) &&
    isFiniteNumber(stats.outputTokens) &&
    isFiniteNumber(stats.totalDurationNs) &&
    isFiniteNumber(stats.loadDurationNs) &&
    isFiniteNumber(stats.promptEvalDurationNs) &&
    isFiniteNumber(stats.evalDurationNs)
  );
}

function isCallStats(value: unknown): value is OllamaCallStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stats = value as Partial<OllamaCallStats>;
  return (
    typeof stats.model === 'string' &&
    isFiniteNumber(stats.promptTokens) &&
    isFiniteNumber(stats.outputTokens) &&
    isFiniteNumber(stats.totalDurationNs) &&
    isFiniteNumber(stats.loadDurationNs) &&
    isFiniteNumber(stats.promptEvalDurationNs) &&
    isFiniteNumber(stats.evalDurationNs)
  );
}

function isSessionStats(value: unknown): value is SessionStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stats = value as Partial<SessionStats>;
  return (
    isFiniteNumber(stats.modelCalls) &&
    isFiniteNumber(stats.promptTokens) &&
    isFiniteNumber(stats.outputTokens) &&
    isFiniteNumber(stats.totalDurationNs) &&
    isFiniteNumber(stats.loadDurationNs) &&
    isFiniteNumber(stats.promptEvalDurationNs) &&
    isFiniteNumber(stats.evalDurationNs) &&
    !!stats.models &&
    typeof stats.models === 'object' &&
    Object.values(stats.models).every(isModelStats) &&
    (stats.lastCall === undefined || isCallStats(stats.lastCall))
  );
}

function readStats(id: string): SessionStats {
  const path = getStatsPath(id);
  if (!existsSync(path)) {
    return createEmptyStats();
  }

  try {
    const stats: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return isSessionStats(stats) ? stats : createEmptyStats();
  } catch {
    return createEmptyStats();
  }
}

function writeStats(id: string, stats: SessionStats): void {
  ensureSessionDirectory(id);
  const path = getStatsPath(id);
  const temporaryPath = `${path}.${String(process.pid)}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(stats, null, 2) + '\n', 'utf8');
  renameSync(temporaryPath, path);
}

function ensureSessionsDirectory(): void {
  mkdirSync(SESSIONS_DIRECTORY, { recursive: true });
}

function ensureSessionDirectory(id: string): string {
  const directory = getSessionDirectory(id);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function readMetadata(id: string): SessionMetadata {
  const path = getMetadataPath(id);
  if (!existsSync(path)) {
    throw new Error(`Session not found: ${id}`);
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SessionMetadata;
  } catch {
    throw new Error(`Invalid session metadata: ${id}`);
  }
}

function writeMetadata(metadata: SessionMetadata): void {
  ensureSessionDirectory(metadata.id);
  writeFileSync(
    getMetadataPath(metadata.id),
    JSON.stringify(metadata, null, 2) + '\n',
    'utf8',
  );
}

function readMessages(id: string): Message[] {
  const path = getMessagesPath(id);
  if (!existsSync(path)) {
    return [];
  }

  const content = readFileSync(path, 'utf8').trim();
  if (!content) {
    return [];
  }

  try {
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Message);
  } catch {
    throw new Error(`Invalid session messages: ${id}`);
  }
}

function deriveTitle(message: Message): string {
  // v8 ignore next - title derivation is only reached for user messages
  if (message.role !== ROLE.USER) {
    return DEFAULT_TITLE;
  }

  const normalized = message.content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return DEFAULT_TITLE;
  }

  return normalized.length > TITLE_MAX_LENGTH
    ? normalized.slice(0, TITLE_MAX_LENGTH - 1).trimEnd() + UI.ELLIPSIS
    : normalized;
}

function updateTitle(
  metadata: SessionMetadata,
  message: Message,
): SessionMetadata {
  if (metadata.title !== DEFAULT_TITLE || message.role !== ROLE.USER) {
    return metadata;
  }

  return {
    ...metadata,
    title: deriveTitle(message),
  };
}

export function createSession(model: string): SessionRecord {
  ensureSessionsDirectory();

  const id = uuidv7();
  const now = new Date().toISOString();
  const metadata: SessionMetadata = {
    id,
    createdAt: now,
    updatedAt: now,
    title: DEFAULT_TITLE,
    model,
    directory: process.cwd(),
  };

  ensureSessionDirectory(id);
  writeMetadata(metadata);
  writeFileSync(getMessagesPath(id), '', 'utf8');

  return { metadata, messages: [], stats: createEmptyStats() };
}

export function listSessions(directory = process.cwd()): SessionMetadata[] {
  if (!existsSync(SESSIONS_DIRECTORY)) {
    return [];
  }

  return readdirSync(SESSIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        return [readMetadata(entry.name)];
      } catch {
        return [];
      }
    })
    .filter((metadata) => metadata.directory === directory)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadSession(id: string): SessionRecord {
  return {
    metadata: readMetadata(id),
    messages: readMessages(id),
    stats: readStats(id),
  };
}

export function recordModelCall(
  id: string,
  call: OllamaCallStats,
): SessionStats {
  const current = readStats(id);
  const model = current.models[call.model] ?? {
    calls: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalDurationNs: 0,
    loadDurationNs: 0,
    promptEvalDurationNs: 0,
    evalDurationNs: 0,
  };
  const updated: SessionStats = {
    modelCalls: current.modelCalls + 1,
    promptTokens: current.promptTokens + call.promptTokens,
    outputTokens: current.outputTokens + call.outputTokens,
    totalDurationNs: current.totalDurationNs + call.totalDurationNs,
    loadDurationNs: current.loadDurationNs + call.loadDurationNs,
    promptEvalDurationNs:
      current.promptEvalDurationNs + call.promptEvalDurationNs,
    evalDurationNs: current.evalDurationNs + call.evalDurationNs,
    models: {
      ...current.models,
      [call.model]: {
        calls: model.calls + 1,
        promptTokens: model.promptTokens + call.promptTokens,
        outputTokens: model.outputTokens + call.outputTokens,
        totalDurationNs: model.totalDurationNs + call.totalDurationNs,
        loadDurationNs: model.loadDurationNs + call.loadDurationNs,
        promptEvalDurationNs:
          model.promptEvalDurationNs + call.promptEvalDurationNs,
        evalDurationNs: model.evalDurationNs + call.evalDurationNs,
      },
    },
    lastCall: call,
  };

  writeStats(id, updated);
  return updated;
}

export function appendMessage(
  id: string,
  message: Message,
  model: string,
): SessionMetadata {
  ensureSessionDirectory(id);

  let metadata = readMetadata(id);
  metadata = updateTitle(metadata, message);
  metadata = {
    ...metadata,
    model,
    updatedAt: new Date().toISOString(),
  };

  appendFileSync(getMessagesPath(id), JSON.stringify(message) + '\n', 'utf8');
  writeMetadata(metadata);

  return metadata;
}

export function replaceMessages(
  id: string,
  messages: Message[],
  model: string,
): SessionMetadata {
  ensureSessionDirectory(id);

  const metadata = {
    ...readMetadata(id),
    model,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(
    getMessagesPath(id),
    messages.map((message) => JSON.stringify(message)).join('\n') +
      (messages.length ? '\n' : ''),
    'utf8',
  );
  writeMetadata(metadata);

  return metadata;
}

export function updateSessionModel(id: string, model: string): SessionMetadata {
  const metadata = {
    ...readMetadata(id),
    model,
  };
  writeMetadata(metadata);
  return metadata;
}

export function deleteSessionIfEmpty(id: string): boolean {
  const directory = getSessionDirectory(id);
  if (!existsSync(directory)) {
    return false;
  }

  const messagesPath = getMessagesPath(id);
  const hasMessages =
    existsSync(messagesPath) &&
    readFileSync(messagesPath, 'utf8').trim() !== '';

  if (hasMessages) {
    return false;
  }

  rmSync(directory, { recursive: true, force: false });
  return true;
}

export function deleteSession(id: string): void {
  const directory = getSessionDirectory(id);
  if (!existsSync(directory)) {
    throw new Error(`Session not found: ${id}`);
  }

  rmSync(directory, { recursive: true, force: false });
}
