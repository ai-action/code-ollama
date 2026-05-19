import { join } from 'node:path';

const {
  mockExecFileSync,
  mockExistsSync,
  mockMkdirSync,
  mockRandomUUID,
  mockRmSync,
  mockSpawnSync,
  mockTmpdir,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockRandomUUID: vi.fn(() => 'test-uuid'),
  mockRmSync: vi.fn(),
  mockSpawnSync: vi.fn(),
  mockTmpdir: '/tmp/code-ollama-tests',
  mockWriteFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
  spawnSync: mockSpawnSync,
}));

vi.mock('node:crypto', () => ({
  randomUUID: mockRandomUUID,
}));

vi.mock('node:os', async () => ({
  ...(await vi.importActual('node:os')),
  tmpdir: () => mockTmpdir,
}));

vi.mock('node:fs', async () => ({
  ...(await vi.importActual('node:fs')),
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  rmSync: mockRmSync,
  writeFileSync: mockWriteFileSync,
}));

describe('clipboard', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
    mockExecFileSync.mockImplementation(() => Buffer.alloc(0));
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('writes macOS clipboard images to the temp image directory', async () => {
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(saveClipboardImage('image-1')).toBe(
      join(TEMP_IMAGES_DIRECTORY, 'test-uuid.png'),
    );
    expect(mockMkdirSync).toHaveBeenCalledWith(TEMP_IMAGES_DIRECTORY, {
      recursive: true,
    });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'osascript',
      expect.any(Array),
      { stdio: 'ignore' },
    );
  });

  it('writes linux clipboard images from wl-paste output', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
    mockSpawnSync.mockReturnValueOnce({
      status: 0,
      stdout: Buffer.from('png'),
    });
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(saveClipboardImage('image-2')).toBe(
      join(TEMP_IMAGES_DIRECTORY, 'test-uuid.png'),
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      join(TEMP_IMAGES_DIRECTORY, 'test-uuid.png'),
      Buffer.from('png'),
      { flag: 'wx', mode: 0o600 },
    );
  });

  it('throws a fallback error when no linux clipboard tool returns an image', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
    mockSpawnSync.mockReturnValue({ status: 1, stdout: Buffer.alloc(0) });
    const { saveClipboardImage } = await import('./clipboard');

    expect(() => saveClipboardImage('image-3')).toThrow(
      'Clipboard image paste failed. Paste an image path instead.',
    );
  });

  it('falls back to xclip when wl-paste is empty', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
    mockSpawnSync
      .mockReturnValueOnce({ status: 1, stdout: Buffer.alloc(0) })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('png') });
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(saveClipboardImage('image-4')).toBe(
      join(TEMP_IMAGES_DIRECTORY, 'test-uuid.png'),
    );
  });

  it('writes windows clipboard images to png files', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(saveClipboardImage('image-5')).toBe(
      join(TEMP_IMAGES_DIRECTORY, 'test-uuid.png'),
    );
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'powershell',
      expect.any(Array),
      { stdio: 'ignore' },
    );
  });

  it('throws a specific error when windows clipboard has no image', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    mockExecFileSync.mockImplementationOnce(() => {
      const error = new Error('empty clipboard') as Error & { status: number };
      error.status = 11;
      throw error;
    });
    const { saveClipboardImage } = await import('./clipboard');

    expect(() => saveClipboardImage('image-6')).toThrow(
      'Clipboard does not contain an image.',
    );
  });

  it('cleans up partial files when clipboard read throws', async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Clipboard failed');
    });
    mockExistsSync.mockReturnValue(true);
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(() => saveClipboardImage('image-7')).toThrow(
      'Clipboard image paste failed. Paste an image path instead.',
    );
    expect(mockRmSync).toHaveBeenCalledWith(
      join(TEMP_IMAGES_DIRECTORY, 'image-7.png'),
      { force: true },
    );
  });

  it('uses the fallback clipboard error message when the source error is blank', async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('');
    });
    const { saveClipboardImage } = await import('./clipboard');

    expect(() => saveClipboardImage('image-8')).toThrow(
      'Clipboard image paste failed. Paste an image path instead.',
    );
  });

  it('maps macOS clipboard-image absence to a friendly message', async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error(
        'Command failed: osascript\nClipboard does not contain an image',
      );
    });
    mockExistsSync.mockReturnValue(true);
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(() => saveClipboardImage('image-10')).toThrow(
      'Clipboard does not contain an image.',
    );
    expect(mockRmSync).toHaveBeenCalledWith(
      join(TEMP_IMAGES_DIRECTORY, 'image-10.png'),
      { force: true },
    );
  });

  it('re-throws non-Error value after cleaning up file', async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'String error';
    });
    mockExistsSync.mockReturnValue(true);
    const { saveClipboardImage, TEMP_IMAGES_DIRECTORY } =
      await import('./clipboard');

    expect(() => saveClipboardImage('image-11')).toThrow('String error');
    expect(mockRmSync).toHaveBeenCalledWith(
      join(TEMP_IMAGES_DIRECTORY, 'image-11.png'),
      { force: true },
    );
  });

  it('throws for unsupported platforms', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'freebsd',
      configurable: true,
    });
    const { saveClipboardImage } = await import('./clipboard');

    expect(() => saveClipboardImage('image-9')).toThrow(
      'Clipboard image paste failed. Paste an image path instead.',
    );
  });

  it('removes temp clipboard images when asked', async () => {
    const path = join(mockTmpdir, 'code-ollama', 'images', 'image-1.png');
    mockExistsSync.mockReturnValue(true);
    const { removeClipboardImage } = await import('./clipboard');

    removeClipboardImage(path);

    expect(mockRmSync).toHaveBeenCalledWith(path, { force: true });
  });

  it('skips clipboard image cleanup when the file is already gone', async () => {
    const path = join(mockTmpdir, 'code-ollama', 'images', 'image-2.png');
    mockExistsSync.mockReturnValue(false);
    const { removeClipboardImage } = await import('./clipboard');

    removeClipboardImage(path);

    expect(mockRmSync).not.toHaveBeenCalled();
  });
});
