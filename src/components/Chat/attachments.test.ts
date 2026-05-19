import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  extractImageAttachments,
  getAttachmentLabel,
  isReadableImagePath,
  resolveAttachmentPath,
} from './attachments';

describe('attachments', () => {
  let testDirectory = '';
  const originalCwd = process.cwd();

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'code-ollama-attachments-'));
    mkdirSync(join(testDirectory, 'nested'), { recursive: true });
    writeFileSync(join(testDirectory, 'diagram.png'), 'png');
    writeFileSync(join(testDirectory, 'nested', 'mockup.jpg'), 'jpg');
    process.chdir(testDirectory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDirectory, { force: true, recursive: true });
  });

  it('returns a basename label for attachments', () => {
    expect(getAttachmentLabel('/tmp/path/mockup.png')).toBe('mockup.png');
  });

  it('detects readable image paths', () => {
    expect(isReadableImagePath('./diagram.png')).toBe(true);
    expect(isReadableImagePath('./missing.png')).toBe(false);
    expect(isReadableImagePath('./diagram.txt')).toBe(false);
  });

  it('resolves relative attachment paths', () => {
    expect(resolveAttachmentPath('./diagram.png')).toContain('/diagram.png');
  });

  it('extracts pasted image paths and leaves prompt text behind', () => {
    const result = extractImageAttachments(
      './diagram.png compare this with ./nested/mockup.jpg',
    );

    expect(result.remainingInput).toBe('compare this with');
    expect(result.attachments.map((path) => basename(path))).toEqual([
      'diagram.png',
      'mockup.jpg',
    ]);
  });

  it('supports quoted image paths with spaces', () => {
    writeFileSync(join(testDirectory, 'wireframe final.png'), 'png');

    const result = extractImageAttachments(
      '"./wireframe final.png" explain this screen',
    );

    expect(result).toMatchObject({
      remainingInput: 'explain this screen',
    });
    expect(result.attachments.map((path) => basename(path))).toEqual([
      'wireframe final.png',
    ]);
  });

  it('ignores missing image paths that only look like attachments', () => {
    expect(extractImageAttachments('"./missing.png" explain this')).toEqual({
      attachments: [],
      remainingInput: '"./missing.png" explain this',
    });
  });

  it('keeps non-image input untouched', () => {
    expect(
      extractImageAttachments('mention diagram.png in the answer'),
    ).toEqual({
      attachments: [],
      remainingInput: 'mention diagram.png in the answer',
    });
  });
});
