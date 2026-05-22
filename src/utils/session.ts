import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { v7 as uuidv7 } from 'uuid';

import { CONFIG, ROLE, UI } from '@/constants';

import type { Message } from './ollama';

const SESSIONS_DIRECTORY = join(CONFIG.DIRECTORY, 'sessions');
const METADATA_FILE_NAME = 'metadata.json';
const MESSAGES_FILE_NAME = 'messages.jsonl';
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

  return { metadata, messages: [] };
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
  };
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
