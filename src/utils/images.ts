import { existsSync, statSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';

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

function normalizeImagePath(path: string): string {
  return path.replaceAll(/\\([ ()'"&;[\]])/g, '$1');
}

export function resolveImagePath(path: string): string {
  const normalizedPath = normalizeImagePath(path);
  return isAbsolute(normalizedPath) ? normalizedPath : resolve(normalizedPath);
}

export function isReadableImagePath(path: string): boolean {
  const normalizedPath = normalizeImagePath(path);

  if (!IMAGE_EXTENSIONS.has(extname(normalizedPath).toLowerCase())) {
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
