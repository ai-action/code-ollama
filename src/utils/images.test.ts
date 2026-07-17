import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isReadableImagePath, resolveImagePath } from './images';

describe('images', () => {
  let testDirectory = '';
  const originalCwd = process.cwd();

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'code-ollama-images-'));
    process.chdir(testDirectory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDirectory, { force: true, recursive: true });
  });

  it('accepts supported image files with case-insensitive extensions', () => {
    writeFileSync(join(testDirectory, 'diagram.PNG'), 'png');

    expect(isReadableImagePath('./diagram.PNG')).toBe(true);
    expect(isReadableImagePath(join(testDirectory, 'diagram.PNG'))).toBe(true);
  });

  it('rejects missing paths, directories, and unsupported extensions', () => {
    mkdirSync(join(testDirectory, 'folder.png'));
    writeFileSync(join(testDirectory, 'diagram.txt'), 'text');

    expect(isReadableImagePath('./missing.png')).toBe(false);
    expect(isReadableImagePath('./folder.png')).toBe(false);
    expect(isReadableImagePath('./diagram.txt')).toBe(false);
  });

  it('resolves relative paths and preserves absolute paths', () => {
    const absolutePath = join(testDirectory, 'diagram.png');

    expect(resolveImagePath('./diagram.png')).toBe(
      join(process.cwd(), 'diagram.png'),
    );
    expect(resolveImagePath(absolutePath)).toBe(absolutePath);
  });

  it('normalizes shell-escaped characters', () => {
    writeFileSync(join(testDirectory, 'wireframe final (1).png'), 'png');

    const escapedPath = String.raw`./wireframe\ final\ \(1\).png`;

    expect(isReadableImagePath(escapedPath)).toBe(true);
    expect(resolveImagePath(escapedPath)).toBe(
      join(process.cwd(), 'wireframe final (1).png'),
    );
  });
});
