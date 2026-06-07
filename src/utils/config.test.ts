import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let testHome = '';

function getConfigDir() {
  return join(testHome, '.code-ollama');
}

function getConfigPath() {
  return join(getConfigDir(), 'config.json');
}

function writeConfig(data: object) {
  mkdirSync(getConfigDir(), { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(data), 'utf8');
}

function removeConfig() {
  if (existsSync(getConfigPath())) {
    rmSync(getConfigPath());
  }
}

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'code-ollama-config-'));
    vi.resetModules();

    vi.doMock('node:os', async () => ({
      ...(await vi.importActual('node:os')),
      homedir: () => testHome,
    }));

    delete process.env.OLLAMA_HOST;
  });

  afterEach(() => {
    process.env.OLLAMA_HOST = originalEnv.OLLAMA_HOST;
    removeConfig();
    vi.doUnmock('node:os');
    rmSync(testHome, { force: true, recursive: true });
  });

  describe('loadConfig', () => {
    it('returns host and theme defaults when no file exists', async () => {
      removeConfig();
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.host).toBe('http://localhost:11434');
      expect(config.model).toBeUndefined();
      expect(config.theme).toBe('github-dark');
    });

    it('reads host and model from config file', async () => {
      writeConfig({
        host: 'http://remote:11434',
        model: 'llama3',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'dracula',
        trustedDirectories: ['/repo'],
      });
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.host).toBe('http://remote:11434');
      expect(config.model).toBe('llama3');
      expect(config.searxngBaseUrl).toBe('https://search.example.com');
      expect(config.theme).toBe('dracula');
      expect(config.trustedDirectories).toEqual(['/repo']);
    });

    it('OLLAMA_HOST overrides config file host', async () => {
      writeConfig({ host: 'http://remote:11434', model: 'llama3' });
      process.env.OLLAMA_HOST = 'http://env-host:11434';
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.host).toBe('http://env-host:11434');
      expect(config.model).toBe('llama3');
    });

    it('returns defaults for missing keys in config file', async () => {
      writeConfig({ model: 'llama3' });
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.host).toBe('http://localhost:11434');
      expect(config.model).toBe('llama3');
      expect(config.searxngBaseUrl).toBeUndefined();
      expect(config.theme).toBe('github-dark');
    });

    it('returns defaults when config file is malformed JSON', async () => {
      mkdirSync(getConfigDir(), { recursive: true });
      writeFileSync(getConfigPath(), 'not json', 'utf8');
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.host).toBe('http://localhost:11434');
      expect(config.model).toBeUndefined();
      expect(config.theme).toBe('github-dark');
    });

    it('returns empty disabledSkills array when not set', async () => {
      removeConfig();
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.disabledSkills).toEqual([]);
    });

    it('reads disabledSkills from config file', async () => {
      writeConfig({
        disabledSkills: ['/path/to/skill1', '/path/to/skill2'],
      });
      const { loadConfig } = await import('./config');
      const config = loadConfig();
      expect(config.disabledSkills).toEqual([
        '/path/to/skill1',
        '/path/to/skill2',
      ]);
    });
  });

  describe('saveConfig', () => {
    it('creates the config file with given values', async () => {
      removeConfig();
      const { saveConfig } = await import('./config');
      saveConfig({
        model: 'mistral',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'nord',
      });
      const saved = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as {
        model: string;
        searxngBaseUrl: string;
        theme: string;
        trustedDirectories?: string[];
      };
      expect(saved.model).toBe('mistral');
      expect(saved.searxngBaseUrl).toBe('https://search.example.com');
      expect(saved.theme).toBe('nord');
      expect(saved.trustedDirectories).toBeUndefined();
    });

    it('merges patch into existing config', async () => {
      writeConfig({ host: 'http://remote:11434', model: 'llama3' });
      const { saveConfig } = await import('./config');
      saveConfig({ model: 'mistral' });
      const saved = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as {
        host: string;
        model: string;
      };
      expect(saved.host).toBe('http://remote:11434');
      expect(saved.model).toBe('mistral');
    });

    it('clears searxngBaseUrl when it is set to undefined', async () => {
      writeConfig({
        host: 'http://remote:11434',
        model: 'llama3',
        searxngBaseUrl: 'https://search.example.com',
      });
      const { saveConfig } = await import('./config');
      saveConfig({ searxngBaseUrl: undefined });
      const saved = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as {
        searxngBaseUrl?: string;
      };
      expect(saved.searxngBaseUrl).toBeUndefined();
    });

    it('saves disabledSkills to config file', async () => {
      removeConfig();
      const { saveConfig } = await import('./config');
      saveConfig({
        disabledSkills: ['/path/to/disabled'],
      });
      const saved = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as {
        disabledSkills: string[];
      };
      expect(saved.disabledSkills).toEqual(['/path/to/disabled']);
    });
  });
});
