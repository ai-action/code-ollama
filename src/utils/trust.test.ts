const { loadConfig, realpathSync, saveConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  realpathSync: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock('node:fs', async () => ({
  ...(await vi.importActual('node:fs')),
  realpathSync,
}));

vi.mock('./config', () => ({
  loadConfig,
  saveConfig,
}));

import {
  getCurrentDirectory,
  isDirectoryTrusted,
  trustDirectory,
} from './trust';

describe('trust', () => {
  beforeEach(() => {
    loadConfig.mockReturnValue({});
    realpathSync.mockReturnValue('/resolved/project');
    saveConfig.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the current working directory', () => {
    expect(getCurrentDirectory()).toBe('/resolved/project');
    expect(realpathSync).toHaveBeenCalledWith(process.cwd());
  });

  it('detects a trusted directory', () => {
    loadConfig.mockReturnValue({ trustedDirectories: ['/resolved/project'] });

    expect(isDirectoryTrusted('/resolved/project')).toBe(true);
  });

  it('returns false when a directory is not trusted', () => {
    loadConfig.mockReturnValue({ trustedDirectories: ['/other/project'] });

    expect(isDirectoryTrusted('/resolved/project')).toBe(false);
  });

  it('returns false when there are no trusted directories', () => {
    loadConfig.mockReturnValue({});

    expect(isDirectoryTrusted('/resolved/project')).toBe(false);
  });

  it('uses the current directory by default when checking trust', () => {
    loadConfig.mockReturnValue({ trustedDirectories: ['/resolved/project'] });

    expect(isDirectoryTrusted()).toBe(true);
  });

  it('persists a new trusted directory', () => {
    loadConfig.mockReturnValue({ trustedDirectories: ['/other/project'] });

    trustDirectory('/resolved/project');

    expect(saveConfig).toHaveBeenCalledWith({
      trustedDirectories: ['/other/project', '/resolved/project'],
    });
  });

  it('uses the current directory by default when persisting trust', () => {
    trustDirectory();

    expect(saveConfig).toHaveBeenCalledWith({
      trustedDirectories: ['/resolved/project'],
    });
  });

  it('does not persist duplicate trusted directories', () => {
    loadConfig.mockReturnValue({ trustedDirectories: ['/resolved/project'] });

    trustDirectory('/resolved/project');

    expect(saveConfig).not.toHaveBeenCalled();
  });
});
