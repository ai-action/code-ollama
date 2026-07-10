interface MockEntryInstance {
  account: string;
  deletePassword: ReturnType<typeof vi.fn>;
  getPassword: ReturnType<typeof vi.fn>;
  service: string;
  setPassword: ReturnType<typeof vi.fn>;
}

interface MockKeyringState {
  entries: MockEntryInstance[];
  passwords: Map<string, string>;
  getError?: Error;
  setError?: Error;
  deleteError?: Error;
  reset: () => void;
}

const keyringState = vi.hoisted<MockKeyringState>(() => ({
  entries: [],
  passwords: new Map<string, string>(),
  getError: undefined,
  setError: undefined,
  deleteError: undefined,
  reset() {
    this.entries = [];
    this.passwords = new Map<string, string>();
    this.getError = undefined;
    this.setError = undefined;
    this.deleteError = undefined;
  },
}));

vi.mock('@napi-rs/keyring', () => ({
  Entry: class MockEntry {
    account: string;
    deletePassword: ReturnType<typeof vi.fn>;
    getPassword: ReturnType<typeof vi.fn>;
    service: string;
    setPassword: ReturnType<typeof vi.fn>;

    constructor(service: string, account: string) {
      this.service = service;
      this.account = account;
      this.getPassword = vi.fn(() => {
        if (keyringState.getError) {
          throw keyringState.getError;
        }
        return keyringState.passwords.get(account) ?? null;
      });
      this.setPassword = vi.fn((value: string) => {
        if (keyringState.setError) {
          throw keyringState.setError;
        }
        keyringState.passwords.set(account, value);
      });
      this.deletePassword = vi.fn(() => {
        if (keyringState.deleteError) {
          throw keyringState.deleteError;
        }
        return keyringState.passwords.delete(account);
      });
      keyringState.entries.push(this);
    }
  },
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

describe('mcp oauth', () => {
  beforeEach(() => {
    vi.resetModules();
    keyringState.reset();
  });

  it('stores OAuth tokens in the OS keyring entry for the server', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: { scopes: 'file_read' },
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    await provider.saveTokens({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
    });

    expect(await provider.tokens()).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
    });
    expect(keyringState.passwords.has('mcp:figma:tokens')).toBe(true);
  });

  it('stores client information, verifier, and discovery state separately', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'sentry',
    });

    await provider.saveClientInformation({ client_id: 'client' });
    await provider.saveCodeVerifier('verifier');
    await provider.saveDiscoveryState({
      authorizationServerUrl: 'https://auth.example.com',
      authorizationServerMetadata: {
        authorization_endpoint: 'https://auth.example.com/authorize',
        issuer: 'https://auth.example.com',
        response_types_supported: ['code'],
        token_endpoint: 'https://auth.example.com/token',
      },
    });

    expect(await provider.clientInformation()).toEqual({ client_id: 'client' });
    expect(await provider.codeVerifier()).toBe('verifier');
    expect(await provider.discoveryState()).toMatchObject({
      authorizationServerUrl: 'https://auth.example.com',
    });
  });

  it('returns configured client id when no registered client is stored', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: { clientId: 'public-client' },
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(await provider.clientInformation()).toEqual({
      client_id: 'public-client',
    });
  });

  it('deletes all stored OAuth credentials for a server', async () => {
    const { deleteMcpOAuthCredentials, McpOAuthClientProvider } =
      await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    await provider.saveTokens({
      access_token: 'access',
      token_type: 'Bearer',
    });
    await provider.saveCodeVerifier('verifier');

    await deleteMcpOAuthCredentials('figma');

    expect(await provider.tokens()).toBeUndefined();
    await expect(provider.codeVerifier()).rejects.toThrow(
      'OAuth code verifier missing',
    );
  });

  it('throws a storage error when the keyring cannot write credentials', async () => {
    const { McpOAuthClientProvider, OAuthCredentialStorageUnavailableError } =
      await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.setError = new Error('keyring unavailable');

    await expect(
      provider.saveTokens({ access_token: 'access', token_type: 'Bearer' }),
    ).rejects.toBeInstanceOf(OAuthCredentialStorageUnavailableError);
  });

  it('exposes the OAuth authorization required error and URL', async () => {
    const { OAuthAuthorizationRequiredError } = await import('./oauth');
    const url = new URL('https://auth.example.com/authorize');
    const error = new OAuthAuthorizationRequiredError(url);

    expect(error.name).toBe('OAuthAuthorizationRequiredError');
    expect(error.authorizationUrl).toBe(url);
    expect(error.message).toBe(
      'OAuth authorization required: https://auth.example.com/authorize',
    );
  });

  it('exposes the OAuth credential storage unavailable error', async () => {
    const { OAuthCredentialStorageUnavailableError } = await import('./oauth');
    const cause = new Error('keychain locked');
    const error = new OAuthCredentialStorageUnavailableError(cause);

    expect(error.name).toBe('OAuthCredentialStorageUnavailableError');
    expect(error.message).toBe('OAuth credential storage unavailable');
    expect(error.cause).toBe(cause);
  });

  it('creates an OAuth session with a local callback', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession('figma', {
      scopes: 'file_read',
    });

    expect(session.callback.redirectUrl.hostname).toBe('127.0.0.1');
    expect(session.callback.redirectUrl.pathname).toBe('/callback');
    expect(session.provider).toBeInstanceOf(
      (await import('./oauth')).McpOAuthClientProvider,
    );

    await session.callback.close();
  });

  it('throws when the configured OAuth callback port is invalid', async () => {
    const { createMcpOAuthSession } = await import('./oauth');

    await expect(
      createMcpOAuthSession('figma', { callbackPort: 0 }),
    ).rejects.toThrow('oauth.callbackPort must be an integer from 1 to 65535');
    await expect(
      createMcpOAuthSession('figma', { callbackPort: 70000 }),
    ).rejects.toThrow('oauth.callbackPort must be an integer from 1 to 65535');
  });

  it('returns the configured redirect URL from the provider', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const redirectUrl = new URL('http://127.0.0.1:3000/callback');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl,
      serverName: 'figma',
    });

    expect(provider.redirectUrl).toBe(redirectUrl);
  });

  it('includes OAuth scopes in client metadata when configured', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: { scopes: 'file_read' },
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    const metadata = provider.clientMetadata;

    expect(metadata.redirect_uris).toEqual(['http://127.0.0.1:3000/callback']);
    expect(metadata.client_name).toContain('code-ollama figma');
    expect(metadata.software_id).toBe('code-ollama');
    expect(metadata.scope).toBe('file_read');
  });

  it('omits OAuth scope from client metadata when not configured', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(provider.clientMetadata.scope).toBeUndefined();
  });

  it('returns undefined client information when nothing is stored or configured', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(await provider.clientInformation()).toBeUndefined();
  });

  it('returns undefined authorization URL before redirection', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(provider.getAuthorizationUrl()).toBeUndefined();
  });

  it('generates a unique state for each authorization request', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(provider.state()).not.toBe(provider.state());
  });

  it('opens the authorization URL and stores it on redirect', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const { spawn } = await import('node:child_process');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    const url = new URL('https://auth.example.com/authorize');

    provider.redirectToAuthorization(url);

    expect(provider.getAuthorizationUrl()).toBe(url);
    expect(spawn).toHaveBeenCalledWith(
      'open',
      ['https://auth.example.com/authorize'],
      { detached: true, stdio: 'ignore' },
    );
  });

  it('throws when the code verifier is missing', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    await expect(provider.codeVerifier()).rejects.toThrow(
      'OAuth code verifier missing',
    );
  });

  it('stores and retrieves the discovery state', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    const state = {
      authorizationServerUrl: 'https://auth.example.com',
      authorizationServerMetadata: {
        authorization_endpoint: 'https://auth.example.com/authorize',
        issuer: 'https://auth.example.com',
        response_types_supported: ['code'],
        token_endpoint: 'https://auth.example.com/token',
      },
    };

    await provider.saveDiscoveryState(state);

    expect(await provider.discoveryState()).toEqual(state);
  });

  it('invalidates a single credential scope', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    await provider.saveTokens({
      access_token: 'access',
      token_type: 'Bearer',
    });
    await provider.saveCodeVerifier('verifier');

    await provider.invalidateCredentials('tokens');

    expect(await provider.tokens()).toBeUndefined();
    expect(await provider.codeVerifier()).toBe('verifier');
  });

  it('invalidates all credentials through the provider', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    await provider.saveTokens({
      access_token: 'access',
      token_type: 'Bearer',
    });
    await provider.saveCodeVerifier('verifier');

    await provider.invalidateCredentials('all');

    expect(await provider.tokens()).toBeUndefined();
    await expect(provider.codeVerifier()).rejects.toThrow(
      'OAuth code verifier missing',
    );
  });

  it('deletes all stored credentials for a server', async () => {
    const { deleteMcpOAuthCredentials, McpOAuthClientProvider } =
      await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    await provider.saveClientInformation({ client_id: 'client' });
    await provider.saveDiscoveryState({
      authorizationServerUrl: 'https://auth.example.com',
      authorizationServerMetadata: {
        authorization_endpoint: 'https://auth.example.com/authorize',
        issuer: 'https://auth.example.com',
        response_types_supported: ['code'],
        token_endpoint: 'https://auth.example.com/token',
      },
    });
    await provider.saveTokens({ access_token: 'access', token_type: 'Bearer' });
    await provider.saveCodeVerifier('verifier');

    await deleteMcpOAuthCredentials('figma');

    expect(await provider.clientInformation()).toBeUndefined();
    expect(await provider.discoveryState()).toBeUndefined();
    expect(await provider.tokens()).toBeUndefined();
    await expect(provider.codeVerifier()).rejects.toThrow(
      'OAuth code verifier missing',
    );
  });

  it('treats missing keyring entries as undefined', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.getError = new Error('NoEntry');

    expect(await provider.tokens()).toBeUndefined();
  });

  it('treats "No entry" keyring errors as undefined', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.getError = new Error('No entry for this account');

    expect(await provider.tokens()).toBeUndefined();
  });

  it('treats non-error keyring missing-entry messages as undefined', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.getError = 'NoEntry' as unknown as Error;

    expect(await provider.tokens()).toBeUndefined();
  });

  it('treats non-error keyring missing-entry messages when deleting as absent', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.deleteError = 'NoEntry' as unknown as Error;

    await expect(
      provider.invalidateCredentials('tokens'),
    ).resolves.toBeUndefined();
  });

  it('throws a storage error when the keyring cannot read credentials', async () => {
    const { McpOAuthClientProvider, OAuthCredentialStorageUnavailableError } =
      await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.getError = new Error('keyring unavailable');

    await expect(provider.tokens()).rejects.toBeInstanceOf(
      OAuthCredentialStorageUnavailableError,
    );
  });

  it('ignores missing keyring entries when deleting credentials', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.deleteError = new Error('NoEntry');

    await expect(
      provider.invalidateCredentials('tokens'),
    ).resolves.toBeUndefined();
  });

  it('throws a storage error when the keyring cannot delete credentials', async () => {
    const { McpOAuthClientProvider, OAuthCredentialStorageUnavailableError } =
      await import('./oauth');
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });
    keyringState.deleteError = new Error('keyring unavailable');

    await expect(
      provider.invalidateCredentials('tokens'),
    ).rejects.toBeInstanceOf(OAuthCredentialStorageUnavailableError);
  });

  it('rejects callback requests to unexpected paths', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession('figma');
    const response = await fetch(
      new URL('/wrong', session.callback.redirectUrl),
    );

    expect(response.status).toBe(404);

    await session.callback.close();
  });

  it('rejects callback requests with an authorization error', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession('figma');
    const waitPromise = session.callback.waitForCode();
    const response = await fetch(
      `${session.callback.redirectUrl.toString()}?error=access_denied`,
    );

    expect(response.status).toBe(400);
    await expect(waitPromise).rejects.toThrow(
      'OAuth authorization failed: access_denied',
    );

    await session.callback.close();
  });

  it('rejects callback requests when the authorization code is missing', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession('figma');
    const waitPromise = session.callback.waitForCode();
    const response = await fetch(session.callback.redirectUrl.toString());

    expect(response.status).toBe(400);
    await expect(waitPromise).rejects.toThrow(
      'OAuth authorization code missing',
    );

    await session.callback.close();
  });

  it('resolves the callback with the authorization code', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession('figma');
    const waitPromise = session.callback.waitForCode();
    const response = await fetch(
      `${session.callback.redirectUrl.toString()}?code=abc123`,
    );

    expect(response.status).toBe(200);
    await expect(waitPromise).resolves.toBe('abc123');

    await session.callback.close();
  });

  it('times out when no callback request is received', async () => {
    const { createMcpOAuthSession } = await import('./oauth');
    const session = await createMcpOAuthSession(
      'figma',
      {},
      { callbackTimeoutMs: 1 },
    );
    const waitPromise = session.callback.waitForCode();

    await expect(waitPromise).rejects.toThrow('OAuth authorization timed out');

    await session.callback.close();
  });

  it('opens URLs with the platform-specific command', async () => {
    const originalPlatform = process.platform;
    const { McpOAuthClientProvider } = await import('./oauth');
    const { spawn } = await import('node:child_process');
    vi.mocked(spawn).mockClear();

    for (const platform of ['darwin', 'linux', 'win32']) {
      Object.defineProperty(process, 'platform', { value: platform });
      const provider = new McpOAuthClientProvider({
        oauth: {},
        redirectUrl: new URL('http://127.0.0.1:3000/callback'),
        serverName: 'figma',
      });

      provider.redirectToAuthorization(
        new URL('https://auth.example.com/authorize'),
      );
    }

    expect(spawn).toHaveBeenNthCalledWith(
      1,
      'open',
      ['https://auth.example.com/authorize'],
      { detached: true, stdio: 'ignore' },
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'xdg-open',
      ['https://auth.example.com/authorize'],
      { detached: true, stdio: 'ignore' },
    );
    expect(spawn).toHaveBeenNthCalledWith(
      3,
      'cmd',
      ['/c', 'start', '""', 'https://auth.example.com/authorize'],
      { detached: true, stdio: 'ignore' },
    );

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('does not throw when the browser cannot be opened', async () => {
    const { McpOAuthClientProvider } = await import('./oauth');
    const { spawn } = await import('node:child_process');
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('spawn failed');
    });
    const provider = new McpOAuthClientProvider({
      oauth: {},
      redirectUrl: new URL('http://127.0.0.1:3000/callback'),
      serverName: 'figma',
    });

    expect(() => {
      provider.redirectToAuthorization(
        new URL('https://auth.example.com/authorize'),
      );
    }).not.toThrow();
  });
});
