import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

  it('extracts dropped paths with backslash-escaped spaces', () => {
    writeFileSync(join(testDirectory, 'wireframe final.png'), 'png');

    const result = extractImageAttachments(
      String.raw`./wireframe\ final.png explain this screen`,
    );

    expect(result).toMatchObject({
      remainingInput: 'explain this screen',
    });
    expect(result.attachments.map((path) => basename(path))).toEqual([
      'wireframe final.png',
    ]);
  });

  it('extracts dropped paths with multiple escaped characters', () => {
    writeFileSync(
      join(testDirectory, 'Screenshot 2026-07-04 at 12.05.03 AM (1).png'),
      'png',
    );

    const result = extractImageAttachments(
      String.raw`./Screenshot\ 2026-07-04\ at\ 12.05.03\ AM\ \(1\).png describe`,
    );

    expect(result).toMatchObject({
      remainingInput: 'describe',
    });
    expect(result.attachments.map((path) => basename(path))).toEqual([
      'Screenshot 2026-07-04 at 12.05.03 AM (1).png',
    ]);
  });

  it('extracts dropped macOS screenshot paths containing a narrow no-break space', () => {
    // macOS inserts U+202F (NARROW NO-BREAK SPACE) before AM/PM in default
    // screenshot filenames. Shells don't treat it as a separator, so it is
    // never backslash-escaped when the file is dragged into the terminal.
    const fileName = 'Screenshot 2026-07-04 at 12.04.55\u202FAM.png';
    writeFileSync(join(testDirectory, fileName), 'png');

    const result = extractImageAttachments(
      `./Screenshot\\ 2026-07-04\\ at\\ 12.04.55\u202FAM.png explain this`,
    );

    expect(result).toMatchObject({
      remainingInput: 'explain this',
    });
    expect(result.attachments.map((path) => basename(path))).toEqual([
      fileName,
    ]);
  });

  it('ignores escaped paths that do not exist', () => {
    const input = String.raw`./missing\ shot.png explain this`;

    expect(extractImageAttachments(input)).toEqual({
      attachments: [],
      remainingInput: input,
    });
  });

  it('keeps Windows-style path separators intact', () => {
    const windowsPath = String.raw`C:\Users\mark\pic.png`;

    expect(resolveAttachmentPath(windowsPath)).toContain(
      String.raw`C:\Users\mark\pic.png`,
    );
    expect(extractImageAttachments(`${windowsPath} explain`)).toEqual({
      attachments: [],
      remainingInput: `${windowsPath} explain`,
    });
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
