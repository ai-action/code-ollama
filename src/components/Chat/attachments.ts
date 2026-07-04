import { existsSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, resolve } from 'node:path';

export interface Attachment {
  id: string;
  isTemp: boolean;
  label: string;
  path: string;
}

export interface ExtractedAttachments {
  attachments: string[];
  remainingInput: string;
}

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
]);

const PATH_CANDIDATE_PATTERN =
  /"([^"\n\r]+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))"|'([^'\n\r]+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))'|((?:\\[ '"]|[^ \t\r\n"'`])+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))/gi;

function normalizeCandidatePath(value: string): string {
  return value.replaceAll(/\\([ ()'"&;[\]])/g, '$1');
}

function isPathLikeCandidate(candidate: string, matchedValue: string): boolean {
  return (
    matchedValue.startsWith('"') ||
    matchedValue.startsWith("'") ||
    candidate.includes('/') ||
    candidate.includes('\\') ||
    candidate.startsWith('.')
  );
}

export function getAttachmentLabel(path: string): string {
  return basename(path);
}

export function isReadableImagePath(path: string): boolean {
  const normalizedPath = normalizeCandidatePath(path);
  const extension = extname(normalizedPath).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(extension)) {
    return false;
  }

  const resolvedPath = isAbsolute(normalizedPath)
    ? normalizedPath
    : resolve(normalizedPath);

  if (!existsSync(resolvedPath)) {
    return false;
  }

  try {
    return statSync(resolvedPath).isFile();
  } catch {
    // v8 ignore next
    return false;
  }
}

export function resolveAttachmentPath(path: string): string {
  const normalizedPath = normalizeCandidatePath(path);
  return isAbsolute(normalizedPath) ? normalizedPath : resolve(normalizedPath);
}

export function extractImageAttachments(input: string): ExtractedAttachments {
  const attachments: string[] = [];
  const segments: string[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(PATH_CANDIDATE_PATTERN)) {
    const matchedValue = match[0];
    const candidate = match
      .slice(1)
      .find((value): value is string => Boolean(value));

    // v8 ignore start
    if (candidate === undefined) {
      continue;
    }
    // v8 ignore stop

    if (!isPathLikeCandidate(candidate, matchedValue)) {
      continue;
    }

    if (!isReadableImagePath(candidate)) {
      continue;
    }

    attachments.push(resolveAttachmentPath(candidate));
    segments.push(input.slice(lastIndex, match.index));
    lastIndex = match.index + matchedValue.length;
  }

  if (!attachments.length) {
    return {
      attachments,
      remainingInput: input,
    };
  }

  segments.push(input.slice(lastIndex));

  return {
    attachments,
    remainingInput: segments
      .join('')
      .replaceAll(/\s{2,}/g, ' ')
      .trim(),
  };
}
