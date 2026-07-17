import { basename, isAbsolute, relative } from 'node:path';

import { clipboard } from '@/utils';
import { isReadableImagePath, resolveImagePath } from '@/utils/images';

export { isReadableImagePath } from '@/utils/images';
export { resolveImagePath as resolveAttachmentPath } from '@/utils/images';

export interface Attachment {
  id: string;
  isTemp: boolean;
  path: string;
}

export interface ExtractedAttachments {
  attachments: string[];
  remainingInput: string;
}

const PATH_CANDIDATE_PATTERN =
  /"([^"\n\r]+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))"|'([^'\n\r]+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))'|((?:\\[ '"]|[^ \t\r\n"'`])+\.(?:avif|bmp|gif|heic|heif|jpeg|jpg|png|tif|tiff|webp))/gi;

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

function isClipboardImagePath(path: string): boolean {
  const relativePath = relative(clipboard.TEMP_IMAGES_DIRECTORY, path);
  return (
    relativePath !== '' &&
    !relativePath.startsWith('..') &&
    !isAbsolute(relativePath)
  );
}

export function getAttachmentLabels(paths: string[]): string[] {
  let clipboardImageIndex = 0;

  return paths.map((path) => {
    if (!isClipboardImagePath(path)) {
      return getAttachmentLabel(path);
    }

    clipboardImageIndex += 1;
    return `Image ${String(clipboardImageIndex)}`;
  });
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

    attachments.push(resolveImagePath(candidate));
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
