interface MockCallResult {
  content: {
    type: string;
    [key: string]: unknown;
  }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

interface MockSdkState {
  clients: MockClient[];
  transports: MockTransport[];
  nextTools: {
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }[][];
  callResult: MockCallResult;
  callError: unknown;
  connectErrors: Error[];
  clientCloseErrors: Error[];
  transportCloseErrors: Error[];
  callToolParams: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
  loadConfig: ReturnType<typeof vi.fn>;
  reset: () => void;
}

const sdkState = vi.hoisted<MockSdkState>(() => ({
  clients: [] as MockClient[],
  transports: [] as MockTransport[],
  nextTools: [] as {
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }[][],
  callResult: {
    content: [{ type: 'text', text: 'tool output' }],
  },
  callError: undefined,
  connectErrors: [] as Error[],
  clientCloseErrors: [] as Error[],
  transportCloseErrors: [] as Error[],
  callToolParams: [] as {
    name: string;
    arguments: Record<string, unknown>;
  }[],
  loadConfig: vi.fn(),
  reset() {
    this.clients = [];
    this.transports = [];
    this.nextTools = [];
    this.callResult = {
      content: [{ type: 'text', text: 'tool output' }],
    };
    this.callError = undefined;
    this.connectErrors = [];
    this.clientCloseErrors = [];
    this.transportCloseErrors = [];
    this.callToolParams = [];
    this.loadConfig.mockReset();
  },
}));

class MockClient {
  tools = sdkState.nextTools.shift() ?? [];

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

vi.mock('@modelcontextprotocol/sdk/client', () => ({
  Client: MockClient,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio', () => ({
  StdioClientTransport: MockTransport,
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
    const { closeMcpClients, getMcpServerStatuses, getMcpToolDefinitions } =
      await import('./tools');

    await getMcpToolDefinitions();
    expect(getMcpServerStatuses()).toHaveLength(1);

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
