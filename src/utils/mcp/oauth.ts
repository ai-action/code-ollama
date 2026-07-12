import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from '@modelcontextprotocol/sdk/client/auth';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth';
import type { Entry } from '@napi-rs/keyring';

import { PACKAGE } from '@/constants';
import type { McpServerOAuthConfig } from '@/types';

const KEYRING_SERVICE = PACKAGE.NAME;
const CALLBACK_PATH = '/callback';
const CALLBACK_TIMEOUT_MS = 120_000;

type OAuthStoreKey = 'client' | 'discovery' | 'tokens' | 'verifier';

let keyringEntry: Promise<typeof Entry> | undefined;

async function getKeyringEntry(): Promise<typeof Entry> {
  keyringEntry ??= import('@napi-rs/keyring').then(({ Entry }) => Entry);
  return keyringEntry;
}

export class OAuthCredentialStorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('OAuth credential storage unavailable', { cause });
    this.name = 'OAuthCredentialStorageUnavailableError';
  }
}

export class OAuthAuthorizationRequiredError extends Error {
  constructor(public readonly authorizationUrl: URL) {
    super(`OAuth authorization required: ${authorizationUrl.toString()}`);
    this.name = 'OAuthAuthorizationRequiredError';
  }
}

export interface McpOAuthSession {
  callback: LocalOAuthCallback;
  provider: McpOAuthClientProvider;
}

interface McpOAuthSessionOptions {
  callbackTimeoutMs?: number;
}

export interface LocalOAuthCallback {
  close: () => Promise<void>;
  redirectUrl: URL;
  waitForCode: () => Promise<string>;
}

export async function createMcpOAuthSession(
  serverName: string,
  oauth: McpServerOAuthConfig = {},
  options: McpOAuthSessionOptions = {},
): Promise<McpOAuthSession> {
  const callback = await createLocalOAuthCallback(
    oauth.callbackPort,
    options.callbackTimeoutMs ?? CALLBACK_TIMEOUT_MS,
  );

  return {
    callback,
    provider: new McpOAuthClientProvider({
      oauth,
      redirectUrl: callback.redirectUrl,
      serverName,
    }),
  };
}

export async function deleteMcpOAuthCredentials(
  serverName: string,
): Promise<void> {
  const store = new KeyringOAuthStore(serverName);
  await Promise.all([
    store.delete('client'),
    store.delete('discovery'),
    store.delete('tokens'),
    store.delete('verifier'),
  ]);
}

export class McpOAuthClientProvider implements OAuthClientProvider {
  private authorizationUrl?: URL;
  private readonly store: KeyringOAuthStore;

  constructor(
    private readonly options: {
      oauth: McpServerOAuthConfig;
      redirectUrl: URL;
      serverName: string;
    },
  ) {
    this.store = new KeyringOAuthStore(options.serverName);
  }

  get redirectUrl(): URL {
    return this.options.redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl.toString()],
      client_name: `${PACKAGE.NAME} ${this.options.serverName}`,
      software_id: PACKAGE.NAME,
      software_version: PACKAGE.VERSION,
      ...(this.options.oauth.scopes
        ? { scope: this.options.oauth.scopes }
        : {}),
    };
  }

  getAuthorizationUrl(): URL | undefined {
    return this.authorizationUrl;
  }

  state(): string {
    return randomUUID();
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const stored = await this.store.get<OAuthClientInformationMixed>('client');
    if (stored) {
      return stored;
    }

    if (this.options.oauth.clientId) {
      return { client_id: this.options.oauth.clientId };
    }
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformationMixed,
  ): Promise<void> {
    await this.store.set('client', clientInformation);
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return this.store.get<OAuthTokens>('tokens');
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.store.set('tokens', tokens);
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.authorizationUrl = authorizationUrl;
    openUrl(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.store.set('verifier', codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    const verifier = await this.store.get<string>('verifier');
    if (!verifier) {
      throw new Error('OAuth code verifier missing');
    }

    return verifier;
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'discovery' | 'tokens' | 'verifier',
  ): Promise<void> {
    if (scope === 'all') {
      await deleteMcpOAuthCredentials(this.options.serverName);
      return;
    }

    await this.store.delete(scope);
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return this.store.get<OAuthDiscoveryState>('discovery');
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.store.set('discovery', state);
  }
}

class KeyringOAuthStore {
  constructor(private readonly serverName: string) {}

  async get<T>(key: OAuthStoreKey): Promise<T | undefined> {
    try {
      const Entry = await getKeyringEntry();
      const value = new Entry(KEYRING_SERVICE, this.account(key)).getPassword();
      if (!value) {
        return undefined;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      if (isMissingCredentialError(error)) {
        return undefined;
      }

      throw new OAuthCredentialStorageUnavailableError(error);
    }
  }

  async set(key: OAuthStoreKey, value: unknown): Promise<void> {
    try {
      const Entry = await getKeyringEntry();
      new Entry(KEYRING_SERVICE, this.account(key)).setPassword(
        JSON.stringify(value),
      );
    } catch (error) {
      throw new OAuthCredentialStorageUnavailableError(error);
    }
  }

  async delete(key: OAuthStoreKey): Promise<void> {
    try {
      const Entry = await getKeyringEntry();
      new Entry(KEYRING_SERVICE, this.account(key)).deletePassword();
    } catch (error) {
      if (!isMissingCredentialError(error)) {
        throw new OAuthCredentialStorageUnavailableError(error);
      }

      return;
    }
  }

  private account(key: OAuthStoreKey): string {
    return `mcp:${this.serverName}:${key}`;
  }
}

async function createLocalOAuthCallback(
  callbackPort?: number,
  callbackTimeoutMs = CALLBACK_TIMEOUT_MS,
): Promise<LocalOAuthCallback> {
  if (callbackPort !== undefined && !isValidPort(callbackPort)) {
    throw new Error('oauth.callbackPort must be an integer from 1 to 65535');
  }

  let timeout: NodeJS.Timeout | undefined;
  type CallbackResult = { code: string } | { error: Error };
  let settleResult!: (result: CallbackResult) => void;

  const codePromise = new Promise<CallbackResult>((resolve) => {
    settleResult = resolve;
  });

  const server = createServer((request, response) => {
    // v8 ignore next -- Node.js always provides request.url as a string.
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== CALLBACK_PATH) {
      response.writeHead(404).end('Not found');
      return;
    }

    const error = url.searchParams.get('error');
    if (error) {
      response
        .writeHead(400)
        .end('Authorization failed. You can close this tab.');
      settleResult({
        error: new Error(`OAuth authorization failed: ${error}`),
      });
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      response.writeHead(400).end('Authorization code missing.');
      settleResult({ error: new Error('OAuth authorization code missing') });
      return;
    }

    response
      .writeHead(200)
      .end('Authorization complete. You can close this tab.');
    settleResult({ code });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(callbackPort ?? 0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const redirectUrl = new URL(
    `http://127.0.0.1:${String(address.port)}${CALLBACK_PATH}`,
  );

  const waitForCode = () => {
    timeout ??= setTimeout(() => {
      settleResult({ error: new Error('OAuth authorization timed out') });
    }, callbackTimeoutMs);

    const cleanup = async () => {
      clearTimeout(timeout);
      timeout = undefined;
      await closeServer(server);
    };

    const waitPromise = codePromise.then(async (result) => {
      await cleanup();
      if ('error' in result) {
        throw result.error;
      }
      return result.code;
    });
    waitPromise.catch(() => {
      // Avoid unhandled rejection before the caller attaches handlers.
    });
    return waitPromise;
  };

  return {
    close: () => closeServer(server),
    redirectUrl,
    waitForCode,
  };
}

function closeServer(server: Server | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (!server?.listening) {
      resolve();
      return;
    }

    server.close(() => {
      resolve();
    });
  });
}

function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function isMissingCredentialError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('NoEntry') || message.includes('No entry');
}

function openUrl(url: URL): void {
  const href = url.toString();
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['/c', 'start', '""', href] : [href];

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // The URL remains visible in the MCP status error if the browser cannot open.
  }
}
