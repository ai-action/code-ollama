interface MockCallResult {
  content: {
    type: string;
    [key: string]: unknown;
  }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

interface MockResource {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

interface MockReadResourceResult {
  contents: (
    | {
        uri: string;
        text: string;
        mimeType?: string;
      }
    | {
        uri: string;
        blob: string;
        mimeType?: string;
      }
  )[];
}

interface MockSdkState {
  clients: MockClient[];
  transports: MockTransport[];
  httpTransports: MockHttpTransport[];
  nextTools: {
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }[][];
  nextResources: {
    nextCursor?: string;
    resources: MockResource[];
  }[][];
  callResult: MockCallResult;
  callError: unknown;
  readResourceResult: MockReadResourceResult;
  readResourceError: unknown;
  connectErrors: Error[];
  listResourceErrors: Error[];
  clientCloseErrors: Error[];
  transportCloseErrors: Error[];
  callToolParams: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
  readResourceParams: { uri: string }[];
  loadConfig: ReturnType<typeof vi.fn>;
  reset: () => void;
}

const sdkState = vi.hoisted<MockSdkState>(() => ({
  clients: [] as MockClient[],
  transports: [] as MockTransport[],
  httpTransports: [] as MockHttpTransport[],
  nextTools: [] as {
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }[][],
  nextResources: [] as {
    nextCursor?: string;
    resources: MockResource[];
  }[][],
  callResult: {
    content: [{ type: 'text', text: 'tool output' }],
  },
  callError: undefined,
  readResourceResult: {
    contents: [{ uri: 'file:///readme.md', text: 'resource output' }],
  },
  readResourceError: undefined,
  connectErrors: [] as Error[],
  listResourceErrors: [] as Error[],
  clientCloseErrors: [] as Error[],
  transportCloseErrors: [] as Error[],
  callToolParams: [] as {
    name: string;
    arguments: Record<string, unknown>;
  }[],
  readResourceParams: [] as { uri: string }[],
  loadConfig: vi.fn(),
  reset() {
    this.clients = [];
    this.transports = [];
    this.httpTransports = [];
    this.nextTools = [];
    this.nextResources = [];
    this.callResult = {
      content: [{ type: 'text', text: 'tool output' }],
    };
    this.callError = undefined;
    this.readResourceResult = {
      contents: [{ uri: 'file:///readme.md', text: 'resource output' }],
    };
    this.readResourceError = undefined;
    this.connectErrors = [];
    this.listResourceErrors = [];
    this.clientCloseErrors = [];
    this.transportCloseErrors = [];
    this.callToolParams = [];
    this.readResourceParams = [];
    this.loadConfig.mockReset();
  },
}));

class MockClient {
  tools = sdkState.nextTools.shift() ?? [];
  resourcePages = sdkState.nextResources.shift() ?? [{ resources: [] }];

  constructor() {
    sdkState.clients.push(this);
  }

  connect = vi.fn(() => {
    const error = sdkState.connectErrors.shift();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  });

  listTools = vi.fn(() =>
    Promise.resolve({
      tools: this.tools,
    }),
  );

  listResources = vi.fn(() => {
    const error = sdkState.listResourceErrors.shift();
    if (error) {
      return Promise.reject(error);
    }

    return Promise.resolve(this.resourcePages.shift() ?? { resources: [] });
  });

  readResource = vi.fn((params: { uri: string }) => {
    sdkState.readResourceParams.push(params);
    if (sdkState.readResourceError) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(sdkState.readResourceError);
    }
    return Promise.resolve(sdkState.readResourceResult);
  });

  callTool = vi.fn(
    (params: { name: string; arguments: Record<string, unknown> }) => {
      sdkState.callToolParams.push(params);
      if (sdkState.callError) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(sdkState.callError);
      }
      return Promise.resolve(sdkState.callResult);
    },
  );

  close = vi.fn(() => {
    const error = sdkState.clientCloseErrors.shift();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  });
}

class MockTransport {
  constructor(
    public params: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      stderr?: string;
    },
  ) {
    sdkState.transports.push(this);
  }

  close = vi.fn(() => {
    const error = sdkState.transportCloseErrors.shift();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  });
}

class MockHttpTransport {
  constructor(
    public url: URL,
    public options?: { requestInit?: { headers?: Record<string, string> } },
  ) {
    sdkState.httpTransports.push(this);
  }

  close = vi.fn(() => {
    const error = sdkState.transportCloseErrors.shift();
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  });
}

vi.mock('@modelcontextprotocol/sdk/client', () => ({
  Client: MockClient,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio', () => ({
  StdioClientTransport: MockTransport,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp', () => ({
  StreamableHTTPClientTransport: MockHttpTransport,
}));

vi.mock('../config', () => ({
  loadConfig: sdkState.loadConfig,
}));

describe('mcp tools', () => {
  beforeEach(() => {
    vi.resetModules();
    sdkState.reset();
  });

  it('recognizes and parses MCP tool names', async () => {
    const { isMcpToolName, parseMcpToolName } = await import('./tools');

    expect(isMcpToolName('mcp__github__search')).toBe(true);
    expect(isMcpToolName('read_file')).toBe(false);
    expect(parseMcpToolName('mcp__github__search')).toEqual({
      serverName: 'github',
      toolName: 'search',
    });
    expect(parseMcpToolName('read_file')).toBeNull();
    expect(parseMcpToolName('mcp__invalid')).toBeNull();
  });

  it('loads tools from enabled stdio servers and skips disabled servers', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          env: { API_KEY: 'secret' },
        },
        disabledDocs: {
          command: 'node',
          args: ['server.js'],
          disabled: true,
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve-library-id',
          description: 'Resolve a library id',
          inputSchema: {
            type: 'object',
            properties: { libraryName: { type: 'string' } },
            required: ['libraryName'],
          },
        },
      ],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(sdkState.transports).toHaveLength(1);
    expect(sdkState.transports[0]?.params.command).toBe('npx');
    expect(sdkState.transports[0]?.params.args).toEqual([
      '-y',
      '@upstash/context7-mcp',
    ]);
    expect(sdkState.transports[0]?.params.env).toMatchObject({
      API_KEY: 'secret',
    });
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.function.name).toBe('mcp__docs__resolve_library_id');
    expect(definitions[0]?.function.parameters).toEqual({
      type: 'object',
      properties: { libraryName: { type: 'string' } },
      required: ['libraryName'],
    });
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve_library_id'],
      },
      {
        name: 'disabledDocs',
        status: 'disabled',
        toolNames: [],
      },
    ]);
  });

  it('loads tools from HTTP MCP servers and passes URL and headers', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        httpDocs: {
          url: 'http://localhost:3000/sse',
          headers: { Authorization: 'Bearer token' },
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'search', inputSchema: { type: 'object' } }],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(sdkState.httpTransports).toHaveLength(1);
    expect(sdkState.httpTransports[0]?.url.toString()).toBe(
      'http://localhost:3000/sse',
    );
    expect(sdkState.httpTransports[0]?.options).toEqual({
      requestInit: { headers: { Authorization: 'Bearer token' } },
    });
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.function.name).toBe('mcp__httpDocs__search');
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'httpDocs',
        status: 'loaded',
        transportType: 'http',
        toolNames: ['mcp__httpDocs__search'],
      },
    ]);
  });

  it('loads tools from HTTP MCP servers without headers', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        httpDocs: {
          url: 'http://localhost:3000/sse',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'search', inputSchema: { type: 'object' } }],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(sdkState.httpTransports[0]?.options).toEqual({});
    expect(getMcpServerStatuses()[0]).toMatchObject({
      name: 'httpDocs',
      status: 'loaded',
      transportType: 'http',
      toolNames: ['mcp__httpDocs__search'],
    });
  });

  it('marks HTTP MCP servers with both url and command as failed', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        bad: {
          url: 'http://localhost:3000/sse',
          command: 'npx',
        },
      },
    });
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(sdkState.httpTransports).toHaveLength(0);
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'bad',
        status: 'failed',
        transportType: 'http',
        toolNames: [],
        error: 'MCP server config cannot include both url and command',
      },
    ]);
  });

  it('keeps local tools available when an MCP server fails to connect', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        broken: {
          command: 'missing-command',
        },
      },
    });
    sdkState.connectErrors = [new Error('spawn failed')];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(definitions).toEqual([]);
    expect(sdkState.clients).toHaveLength(1);
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'broken',
        status: 'failed',
        toolNames: [],
        error: 'spawn failed',
      },
    ]);
  });

  it('generates unique sanitized names for colliding servers and tools', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        'docs!': { command: 'npx' },
        'docs?': { command: 'npx' },
      },
    });
    sdkState.nextTools = [
      [
        { name: 'search-docs', inputSchema: { type: 'object' } },
        { name: 'search docs', inputSchema: { type: 'object' } },
        { name: 'search_docs', inputSchema: { type: 'object' } },
      ],
      [{ name: 'search-docs', inputSchema: { type: 'object' } }],
    ];
    const { getMcpToolDefinitions } = await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(definitions.map((tool) => tool.function.name)).toEqual([
      'mcp__docs__search_docs',
      'mcp__docs__search_docs_2',
      'mcp__docs__search_docs_3',
      'mcp__docs_2__search_docs',
    ]);
    expect(definitions[0]?.function.description).toBe(
      'MCP tool search-docs\nProvided by MCP server docs!.',
    );
  });

  it('falls back to unnamed sanitized name parts', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        '!!!': { command: 'npx' },
      },
    });
    sdkState.nextTools = [[{ name: '***', inputSchema: { type: 'object' } }]];
    const { getMcpToolDefinitions } = await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(definitions[0]?.function.name).toBe('mcp__unnamed__unnamed');
  });

  it('returns no tools when no MCP servers are configured', async () => {
    sdkState.loadConfig.mockReturnValue({});
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await expect(getMcpToolDefinitions()).resolves.toEqual([]);
    expect(getMcpServerStatuses()).toEqual([]);
  });

  it('applies default MCP permissions', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const {
      getMcpToolDefinitions,
      getMcpToolExecutionError,
      getMcpToolPermissions,
      isMcpToolAllowedInMode,
      requiresMcpToolApproval,
    } = await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpToolPermissions('mcp__docs__resolve')).toEqual({
      allowedModes: ['safe', 'auto'],
      autoApprove: false,
      denied: false,
    });
    expect(isMcpToolAllowedInMode('mcp__docs__resolve', 'safe')).toBe(true);
    expect(isMcpToolAllowedInMode('mcp__docs__resolve', 'auto')).toBe(true);
    expect(isMcpToolAllowedInMode('mcp__docs__resolve', 'plan')).toBe(false);
    expect(requiresMcpToolApproval('mcp__docs__resolve')).toBe(true);
    await expect(
      getMcpToolExecutionError('mcp__docs__resolve', 'plan'),
    ).resolves.toBe('Tool not allowed in plan mode: mcp__docs__resolve');
  });

  it('returns default permissions from getMcpToolPermissions for unknown tool names', async () => {
    sdkState.loadConfig.mockReturnValue({ mcpServers: {} });
    const { getMcpToolPermissions } = await import('./tools');

    expect(getMcpToolPermissions('mcp__docs__unknown')).toEqual({
      allowedModes: ['safe', 'auto'],
      autoApprove: false,
      denied: false,
    });
  });

  it('returns undefined from getMcpToolExecutionError for unknown tool names', async () => {
    sdkState.loadConfig.mockReturnValue({ mcpServers: {} });
    const { getMcpToolExecutionError } = await import('./tools');

    await expect(
      getMcpToolExecutionError('mcp__docs__unknown'),
    ).resolves.toBeUndefined();
  });

  it('allows configured MCP tools in plan mode and skips approval for auto-approved tools', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          permissions: {
            allowedModes: ['plan', 'safe', 'auto'],
            autoApprove: ['resolve'],
          },
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const {
      getMcpToolDefinitions,
      getMcpToolExecutionError,
      isMcpToolAllowedInMode,
      requiresMcpToolApproval,
    } = await import('./tools');

    await getMcpToolDefinitions();

    expect(isMcpToolAllowedInMode('mcp__docs__resolve', 'plan')).toBe(true);
    expect(requiresMcpToolApproval('mcp__docs__resolve')).toBe(false);
    await expect(
      getMcpToolExecutionError('mcp__docs__resolve', 'plan'),
    ).resolves.toBeUndefined();
  });

  it('denies configured MCP tools in every mode', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          permissions: {
            allowedModes: ['plan', 'safe', 'auto'],
            autoApprove: ['resolve'],
            deny: ['resolve'],
          },
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const {
      getMcpToolDefinitions,
      getMcpToolExecutionError,
      getMcpToolPermissions,
      isMcpToolAllowedInMode,
      requiresMcpToolApproval,
    } = await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpToolPermissions('mcp__docs__resolve')).toMatchObject({
      autoApprove: true,
      denied: true,
    });
    expect(isMcpToolAllowedInMode('mcp__docs__resolve', 'safe')).toBe(false);
    expect(requiresMcpToolApproval('mcp__docs__resolve')).toBe(false);
    await expect(
      getMcpToolExecutionError('mcp__docs__resolve', 'safe'),
    ).resolves.toBe('Tool not allowed: mcp__docs__resolve');
  });

  it('filters MCP tool definitions by mode visibility', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          permissions: {
            allowedModes: ['plan', 'safe'],
            deny: ['delete'],
          },
        },
        autoOnly: {
          command: 'node',
          permissions: {
            allowedModes: ['auto'],
          },
        },
      },
    });
    sdkState.nextTools = [
      [
        { name: 'resolve', inputSchema: { type: 'object' } },
        { name: 'delete', inputSchema: { type: 'object' } },
      ],
      [{ name: 'search', inputSchema: { type: 'object' } }],
    ];
    const { getMcpToolDefinitionsForMode } = await import('./tools');

    await expect(
      getMcpToolDefinitionsForMode('plan').then((definitions) =>
        definitions.map((definition) => definition.function.name),
      ),
    ).resolves.toEqual(['mcp__docs__resolve']);
    await expect(
      getMcpToolDefinitionsForMode('safe').then((definitions) =>
        definitions.map((definition) => definition.function.name),
      ),
    ).resolves.toEqual(['mcp__docs__resolve']);
    await expect(
      getMcpToolDefinitionsForMode('auto').then((definitions) =>
        definitions.map((definition) => definition.function.name),
      ),
    ).resolves.toEqual(['mcp__autoOnly__search']);
  });

  it('lists MCP resources for loaded servers', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [
            {
              uri: 'file:///repo/README.md',
              name: 'README.md',
              title: 'Readme',
              description: 'Project readme',
              mimeType: 'text/markdown',
              size: 1024,
            },
          ],
        },
      ],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [
          {
            uri: 'file:///repo/README.md',
            name: 'README.md',
            title: 'Readme',
            description: 'Project readme',
            mimeType: 'text/markdown',
            size: 1024,
          },
        ],
      },
    ]);
  });

  it('omits resources when loaded servers return none', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
      },
    ]);
  });

  it('keeps tools loaded when MCP resource listing fails', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.listResourceErrors = [new Error('resources unavailable')];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    const definitions = await getMcpToolDefinitions();

    expect(definitions.map((tool) => tool.function.name)).toEqual([
      'mcp__docs__resolve',
    ]);
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        warnings: ['Failed to list resources: resources unavailable'],
      },
    ]);
  });

  it('paginates MCP resource listing across multiple pages', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          nextCursor: 'page2',
          resources: [{ uri: 'file:///a.md', name: 'a.md' }],
        },
        {
          nextCursor: 'page3',
          resources: [{ uri: 'file:///b.md', name: 'b.md' }],
        },
        {
          resources: [{ uri: 'file:///c.md', name: 'c.md' }],
        },
      ],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(sdkState.clients[0]?.listResources).toHaveBeenCalledTimes(3);
    expect(sdkState.clients[0]?.listResources).toHaveBeenNthCalledWith(
      1,
      undefined,
    );
    expect(sdkState.clients[0]?.listResources).toHaveBeenNthCalledWith(2, {
      cursor: 'page2',
    });
    expect(sdkState.clients[0]?.listResources).toHaveBeenNthCalledWith(3, {
      cursor: 'page3',
    });
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [
          { uri: 'file:///a.md', name: 'a.md' },
          { uri: 'file:///b.md', name: 'b.md' },
          { uri: 'file:///c.md', name: 'c.md' },
        ],
      },
    ]);
  });

  it('returns partial resources and a warning when pagination fails mid-way', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          nextCursor: 'page2',
          resources: [{ uri: 'file:///a.md', name: 'a.md' }],
        },
      ],
    ];
    sdkState.listResourceErrors = [
      undefined as unknown as Error,
      new Error('page 2 failed'),
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [{ uri: 'file:///a.md', name: 'a.md' }],
        warnings: ['Failed to list resources: page 2 failed'],
      },
    ]);
  });

  it('formats non-Error throws as warnings when MCP resource listing fails', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.listResourceErrors = [
      'resource access denied' as unknown as Error,
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        warnings: ['Failed to list resources: resource access denied'],
      },
    ]);
  });

  it('treats method-not-found MCP resource errors as unsupported resources', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const error = new Error('MCP error -32601: Method not found') as Error & {
      code: number;
    };
    error.code = -32601;
    sdkState.listResourceErrors = [error];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
      },
    ]);
  });

  it('treats message-only method-not-found resource errors as unsupported resources', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.listResourceErrors = [
      new Error('MCP error -32601: Method not found'),
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
      },
    ]);
  });

  it('warns when MCP resource errors have a non-method-not-found code', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    const error = new Error('resource access denied') as Error & {
      code: number;
    };
    error.code = -32000;
    sdkState.listResourceErrors = [error];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        warnings: ['Failed to list resources: resource access denied'],
      },
    ]);
  });

  it('reads text MCP resources by URI', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [
            {
              uri: 'file:///readme.md',
              name: 'README.md',
              mimeType: 'text/markdown',
            },
          ],
        },
      ],
    ];
    sdkState.readResourceResult = {
      contents: [
        {
          uri: 'file:///readme.md',
          text: '# Readme',
          mimeType: 'text/markdown',
        },
      ],
    };
    const { readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///readme.md')).resolves.toEqual({
      content: [
        {
          uri: 'file:///readme.md',
          content: '# Readme',
          isBinary: false,
          mimeType: 'text/markdown',
        },
      ],
    });
    expect(sdkState.readResourceParams).toEqual([{ uri: 'file:///readme.md' }]);
  });

  it('formats multiple MCP resource contents and blobs', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///mixed', name: 'mixed' }],
        },
      ],
    ];
    sdkState.readResourceResult = {
      contents: [
        { uri: 'file:///mixed', text: 'text output' },
        {
          uri: 'file:///image.png',
          blob: 'abcdef',
        },
        {
          uri: 'file:///asset.bin',
          blob: 'abcdefghi',
          mimeType: 'application/octet-stream',
        },
      ],
    };
    const { readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///mixed')).resolves.toEqual({
      content: [
        {
          uri: 'file:///mixed',
          content: 'text output',
          isBinary: false,
        },
        {
          uri: 'file:///image.png',
          content: '[resource: file:///image.png, 6 base64 chars]',
          isBinary: true,
        },
        {
          uri: 'file:///asset.bin',
          content: '[resource: file:///asset.bin, 9 base64 chars]',
          isBinary: true,
          mimeType: 'application/octet-stream',
        },
      ],
    });
  });

  it('keeps the first MCP resource owner for duplicate resource URIs', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: { command: 'npx' },
        docsMirror: { command: 'npx' },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
      [{ name: 'search', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///shared.md', name: 'shared.md' }],
        },
      ],
      [
        {
          resources: [{ uri: 'file:///shared.md', name: 'shared.md' }],
        },
      ],
    ];
    const { readMcpResource } = await import('./tools');

    await readMcpResource('file:///shared.md');

    expect(sdkState.clients[0]?.readResource).toHaveBeenCalledWith({
      uri: 'file:///shared.md',
    });
    expect(sdkState.clients[1]?.readResource).not.toHaveBeenCalled();
  });

  it('returns a clear error for unknown MCP resource URIs', async () => {
    sdkState.loadConfig.mockReturnValue({ mcpServers: {} });
    const { readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///missing.md')).resolves.toEqual({
      error: 'Unknown MCP resource: file:///missing.md',
    });
  });

  it('returns MCP resource read errors', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///stale.md', name: 'stale.md' }],
        },
      ],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///readme.md', name: 'README.md' }],
        },
      ],
    ];
    sdkState.readResourceError = new Error('read failed');
    const { readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///readme.md')).resolves.toEqual({
      error: 'read failed',
    });
  });

  it('returns non-Error MCP resource read errors', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///readme.md', name: 'README.md' }],
        },
      ],
    ];
    sdkState.readResourceError = 'read failed';
    const { readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///readme.md')).resolves.toEqual({
      error: 'read failed',
    });
  });

  it('clears MCP resource ownership when clients close', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///readme.md', name: 'README.md' }],
        },
      ],
    ];
    const { closeMcpClients, readMcpResource } = await import('./tools');

    await expect(readMcpResource('file:///readme.md')).resolves.toEqual({
      content: [
        {
          uri: 'file:///readme.md',
          content: 'resource output',
          isBinary: false,
        },
      ],
    });

    await closeMcpClients();

    await expect(readMcpResource('file:///readme.md')).resolves.toEqual({
      error: 'Unknown MCP resource: file:///readme.md',
    });
  });

  it('warns when MCP permissions reference unknown tools or modes', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          permissions: {
            allowedModes: ['safe', 'planning'],
            autoApprove: ['resolve', 'missing-auto'],
            deny: ['missing-deny'],
          },
        },
      },
    });
    sdkState.nextTools = [
      [
        { name: 'resolve', inputSchema: { type: 'object' } },
        { name: 'query_docs', inputSchema: { type: 'object' } },
      ],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve', 'mcp__docs__query_docs'],
        warnings: [
          'permissions.allowedModes contains unknown mode "planning". Valid modes: plan, safe, auto',
          'permissions.autoApprove references unknown tool "missing-auto". Available native tool names: resolve, query_docs',
          'permissions.deny references unknown tool "missing-deny". Available native tool names: resolve, query_docs',
        ],
      },
    ]);
  });

  it('does not warn when MCP permissions match native tool names and modes', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
          permissions: {
            allowedModes: ['plan', 'safe', 'auto'],
            autoApprove: ['resolve'],
            deny: ['query_docs'],
          },
        },
      },
    });
    sdkState.nextTools = [
      [
        { name: 'resolve', inputSchema: { type: 'object' } },
        { name: 'query_docs', inputSchema: { type: 'object' } },
      ],
    ];
    const { getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();

    expect(getMcpServerStatuses()[0]).toMatchObject({
      name: 'docs',
      status: 'loaded',
    });
    expect(getMcpServerStatuses()[0]?.warnings).toBeUndefined();
  });

  it('closes MCP clients and clears cached lifecycle state', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///repo/README.md', name: 'README.md' }],
        },
      ],
    ];
    const { closeMcpClients, getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();
    expect(getMcpServerStatuses()[0]).toMatchObject({
      resources: [{ uri: 'file:///repo/README.md', name: 'README.md' }],
    });

    await closeMcpClients();

    expect(sdkState.clients[0]?.close).toHaveBeenCalledOnce();
    expect(sdkState.transports[0]?.close).not.toHaveBeenCalled();
    expect(getMcpServerStatuses()).toEqual([]);
  });

  it('can close MCP clients before loading and more than once', async () => {
    const { closeMcpClients, getMcpServerStatuses } = await import('./tools');

    await closeMcpClients();
    await closeMcpClients();

    expect(getMcpServerStatuses()).toEqual([]);
  });

  it('falls back to closing the transport when client close fails', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];
    sdkState.nextResources = [
      [
        {
          resources: [{ uri: 'file:///stale.md', name: 'stale.md' }],
        },
      ],
    ];
    sdkState.clientCloseErrors = [new Error('client close failed')];
    const { closeMcpClients, getMcpToolDefinitions } = await import('./tools');

    await getMcpToolDefinitions();
    await closeMcpClients();

    expect(sdkState.clients[0]?.close).toHaveBeenCalledOnce();
    expect(sdkState.transports[0]?.close).toHaveBeenCalledOnce();
  });

  it('reloads MCP tools by closing previous clients and reading current config', async () => {
    sdkState.loadConfig
      .mockReturnValueOnce({
        mcpServers: {
          docs: {
            command: 'npx',
          },
        },
      })
      .mockReturnValueOnce({
        mcpServers: {
          github: {
            command: 'node',
          },
        },
      });
    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
      [{ name: 'search', inputSchema: { type: 'object' } }],
    ];
    const {
      getMcpToolDefinitions,
      getMcpServerStatuses,
      reloadMcpToolDefinitions,
    } = await import('./tools');

    await getMcpToolDefinitions();
    const reloadedDefinitions = await reloadMcpToolDefinitions();

    expect(sdkState.clients[0]?.close).toHaveBeenCalledOnce();
    expect(reloadedDefinitions.map((tool) => tool.function.name)).toEqual([
      'mcp__github__search',
    ]);
    expect(getMcpServerStatuses()).toEqual([
      {
        name: 'github',
        status: 'loaded',
        toolNames: ['mcp__github__search'],
      },
    ]);
  });

  it('calls MCP tools by public name', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve',
          inputSchema: { type: 'object' },
        },
      ],
    ];
    const { callMcpTool, getMcpToolDefinitions } = await import('./tools');
    await getMcpToolDefinitions();

    const result = await callMcpTool('mcp__docs__resolve', {
      libraryName: 'react',
    });

    expect(result).toEqual({ content: 'tool output' });
    expect(sdkState.callToolParams).toEqual([
      { name: 'resolve', arguments: { libraryName: 'react' } },
    ]);
  });

  it('formats mixed MCP result content and errors', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve',
          inputSchema: { type: 'object' },
        },
      ],
    ];
    sdkState.callResult = {
      isError: true,
      structuredContent: { ok: false },
      content: [
        { type: 'text', text: 'text output' },
        { type: 'image', mimeType: 'image/png', data: 'abcd' },
        { type: 'audio', mimeType: 'audio/mpeg', data: 'abcdef' },
        {
          type: 'resource',
          resource: {
            uri: 'file:///readme.md',
            text: '# Readme',
          },
        },
        {
          type: 'resource',
          resource: {
            uri: 'file:///asset.bin',
            blob: 'abcdefghi',
          },
        },
        {
          type: 'resource_link',
          name: 'Readme',
          uri: 'file:///readme.md',
        },
      ],
    };
    const { callMcpTool, getMcpToolDefinitions } = await import('./tools');
    await getMcpToolDefinitions();

    const result = await callMcpTool('mcp__docs__resolve', {});

    expect(result.error).toBe('MCP tool returned an error');
    expect(result.content).toContain('text output');
    expect(result.content).toContain('[image: image/png, 4 base64 chars]');
    expect(result.content).toContain('[audio: audio/mpeg, 6 base64 chars]');
    expect(result.content).toContain('[resource: file:///readme.md]\n# Readme');
    expect(result.content).toContain(
      '[resource: file:///asset.bin, 9 base64 chars]',
    );
    expect(result.content).toContain(
      '[resource link: Readme file:///readme.md]',
    );
    expect(result.content).toContain('"ok": false');
  });

  it('returns MCP call errors', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve',
          inputSchema: { type: 'object' },
        },
      ],
    ];
    sdkState.callError = new Error('call failed');
    const { callMcpTool, getMcpToolDefinitions } = await import('./tools');
    await getMcpToolDefinitions();

    const result = await callMcpTool('mcp__docs__resolve', {});

    expect(result.content).toBe('');
    expect(result.error).toBe('call failed');
    expect(result.stack).toContain('call failed');
  });

  it('returns MCP call errors without stack traces', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve',
          inputSchema: { type: 'object' },
        },
      ],
    ];
    const error = new Error('call failed without stack');
    error.stack = '';
    sdkState.callError = error;
    const { callMcpTool, getMcpToolDefinitions } = await import('./tools');
    await getMcpToolDefinitions();

    const result = await callMcpTool('mcp__docs__resolve', {});

    expect(result).toEqual({
      content: '',
      error: 'call failed without stack',
    });
  });

  it('returns non-Error MCP call errors', async () => {
    sdkState.loadConfig.mockReturnValue({
      mcpServers: {
        docs: {
          command: 'npx',
        },
      },
    });
    sdkState.nextTools = [
      [
        {
          name: 'resolve',
          inputSchema: { type: 'object' },
        },
      ],
    ];
    sdkState.callError = 'string failure';
    const { callMcpTool, getMcpToolDefinitions } = await import('./tools');
    await getMcpToolDefinitions();

    const result = await callMcpTool('mcp__docs__resolve', {});

    expect(result).toEqual({ content: '', error: 'string failure' });
  });

  it('returns a clear error for unknown MCP tools', async () => {
    sdkState.loadConfig.mockReturnValue({ mcpServers: {} });
    const { callMcpTool } = await import('./tools');

    const result = await callMcpTool('mcp__docs__missing', {});

    expect(result.error).toBe('Unknown MCP tool: docs/missing');
  });

  it('returns the original name for malformed unknown MCP tool names', async () => {
    sdkState.loadConfig.mockReturnValue({ mcpServers: {} });
    const { callMcpTool } = await import('./tools');

    const result = await callMcpTool('mcp__missing', {});

    expect(result.error).toBe('Unknown MCP tool: mcp__missing');
  });

  it('drops setServer, setTool, and setServerStatus writes from a stale generation', async () => {
    let resolveConnect!: () => void;
    const connectGate = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });

    sdkState.loadConfig
      .mockReturnValueOnce({
        mcpServers: {
          docs: { command: 'npx' },
        },
      })
      .mockReturnValueOnce({ mcpServers: {} });

    sdkState.nextTools = [
      [{ name: 'resolve', inputSchema: { type: 'object' } }],
    ];

    const originalConnect = MockClient.prototype.connect;
    MockClient.prototype.connect = vi.fn(() =>
      connectGate.then(() => Promise.resolve()),
    );

    const { closeMcpClients, getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    const firstLoad = getMcpToolDefinitions();

    await closeMcpClients();

    resolveConnect();
    await firstLoad;

    MockClient.prototype.connect = originalConnect;

    expect(getMcpServerStatuses()).toEqual([]);
  });
});
