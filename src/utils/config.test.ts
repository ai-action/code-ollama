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
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    process.env.OLLAMA_HOST = originalEnv.OLLAMA_HOST;
    process.env.OLLAMA_MODEL = originalEnv.OLLAMA_MODEL;
    removeConfig();
    vi.doUnmock('node:os');
    rmSync(testHome, { force: true, recursive: true });
  });

  describe('loadConfig', () => {
    it('returns hardcoded defaults when no file and no env vars', async () => {
      removeConfig();
      const { loadConfig } = await import('./config');
      const cfg = loadConfig();
      expect(cfg.host).toBe('http://localhost:11434');
      expect(cfg.model).toBe('gemma4');
    });

    it('reads host and model from config file', async () => {
      writeConfig({ host: 'http://remote:11434', model: 'llama3' });
      const { loadConfig } = await import('./config');
      const cfg = loadConfig();
      expect(cfg.host).toBe('http://remote:11434');
      expect(cfg.model).toBe('llama3');
    });

    it('env vars override config file values', async () => {
      writeConfig({ host: 'http://remote:11434', model: 'llama3' });
      process.env.OLLAMA_HOST = 'http://env-host:11434';
      process.env.OLLAMA_MODEL = 'codellama';
      const { loadConfig } = await import('./config');
      const cfg = loadConfig();
      expect(cfg.host).toBe('http://env-host:11434');
      expect(cfg.model).toBe('codellama');
    });

    it('returns defaults for missing keys in config file', async () => {
      writeConfig({ model: 'llama3' });
      const { loadConfig } = await import('./config');
      const cfg = loadConfig();
      expect(cfg.host).toBe('http://localhost:11434');
      expect(cfg.model).toBe('llama3');
    });

    it('returns defaults when config file is malformed JSON', async () => {
      mkdirSync(getConfigDir(), { recursive: true });
      writeFileSync(getConfigPath(), 'not json', 'utf8');
      const { loadConfig } = await import('./config');
      const cfg = loadConfig();
      expect(cfg.host).toBe('http://localhost:11434');
      expect(cfg.model).toBe('gemma4');
    });
  });

  describe('saveConfig', () => {
    it('creates the config file with given values', async () => {
      removeConfig();
      const { saveConfig } = await import('./config');
      saveConfig({ model: 'mistral' });
      const saved = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as {
        model: string;
      };
      expect(saved.model).toBe('mistral');
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
  });
});
