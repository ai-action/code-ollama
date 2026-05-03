import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.code-ollama');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function writeConfig(data: object) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(data), 'utf8');
}

function removeConfig() {
  if (existsSync(CONFIG_PATH)) {
    rmSync(CONFIG_PATH);
  }
}

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OLLAMA_HOST;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    process.env.OLLAMA_HOST = originalEnv.OLLAMA_HOST;
    process.env.OLLAMA_MODEL = originalEnv.OLLAMA_MODEL;
    removeConfig();
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
      mkdirSync(CONFIG_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, 'not json', 'utf8');
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
      const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as {
        model: string;
      };
      expect(saved.model).toBe('mistral');
    });

    it('merges patch into existing config', async () => {
      writeConfig({ host: 'http://remote:11434', model: 'llama3' });
      const { saveConfig } = await import('./config');
      saveConfig({ model: 'mistral' });
      const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as {
        host: string;
        model: string;
      };
      expect(saved.host).toBe('http://remote:11434');
      expect(saved.model).toBe('mistral');
    });
  });
});
