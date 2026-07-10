import { Text } from 'ink';

import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { McpStatus } from './McpStatus';

const mcpState = vi.hoisted(() => ({
  statuses: [] as {
    name: string;
    status: 'loaded' | 'disabled' | 'failed';
    transportType?: 'http';
    authStatus?: 'authenticated' | 'needs-login';
    toolNames: string[];
    error?: string;
    resources?: {
      uri: string;
      name: string;
      title?: string;
      description?: string;
      mimeType?: string;
      size?: number;
    }[];
    warnings?: string[];
  }[],
  getMcpServerStatuses: vi.fn(() => mcpState.statuses),
  getMcpToolPermissions: vi.fn((_toolName: string) => ({
    allowedModes: ['safe', 'auto'],
    autoApprove: false,
    denied: false,
  })),
  readMcpResource: vi.fn(
    (
      _uri: string,
    ): Promise<
      | {
          content: {
            uri: string;
            content: string;
            isBinary: boolean;
            mimeType?: string;
          }[];
        }
      | { error: string }
    > =>
      Promise.resolve({
        content: [
          {
            uri: 'file:///repo/README.md',
            content: '# Readme',
            isBinary: false,
            mimeType: 'text/markdown',
          },
        ],
      }),
  ),
  reloadMcpToolDefinitions: vi.fn(() => Promise.resolve([])),
  reset() {
    this.statuses = [];
    this.getMcpServerStatuses.mockClear();
    this.getMcpToolPermissions.mockClear();
    this.getMcpToolPermissions.mockReturnValue({
      allowedModes: ['safe', 'auto'],
      autoApprove: false,
      denied: false,
    });
    this.readMcpResource.mockClear();
    this.readMcpResource.mockResolvedValue({
      content: [
        {
          uri: 'file:///repo/README.md',
          content: '# Readme',
          isBinary: false,
          mimeType: 'text/markdown',
        },
      ],
    });
    this.reloadMcpToolDefinitions.mockClear();
    this.reloadMcpToolDefinitions.mockResolvedValue([]);
  },
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  mcp: {
    getMcpServerStatuses: mcpState.getMcpServerStatuses,
    getMcpToolPermissions: mcpState.getMcpToolPermissions,
    readMcpResource: mcpState.readMcpResource,
    reloadMcpToolDefinitions: mcpState.reloadMcpToolDefinitions,
  },
}));

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label: string }) => <Text>{`⏳${label}`}</Text>,
}));

describe('McpStatus', () => {
  beforeEach(() => {
    mcpState.reset();
  });

  it('shows empty state when no MCP servers are configured', async () => {
    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('MCP Servers');
    expect(lastFrame()).toContain('Loading MCP servers...');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No MCP servers configured.');
    });
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('shows loaded, disabled, and failed server statuses', () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve', 'mcp__docs__search'],
      },
      {
        name: 'disabledDocs',
        status: 'disabled',
        toolNames: [],
      },
      {
        name: 'broken',
        status: 'failed',
        toolNames: [],
        error: 'spawn failed',
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Loading MCP servers...');
    expect(lastFrame()).toContain('✓ docs (2 tools)');
    expect(lastFrame()).toContain('1. mcp__docs__resolve');
    expect(lastFrame()).toContain('2. mcp__docs__search');
    expect(lastFrame()).toContain('○ disabledDocs');
    expect(lastFrame()).toContain('disabled');
    expect(lastFrame()).toContain('× broken');
    expect(lastFrame()).toContain('Error: spawn failed');
  });

  it('shows HTTP transport type for HTTP servers', () => {
    mcpState.statuses = [
      {
        name: 'httpDocs',
        status: 'loaded',
        transportType: 'http',
        toolNames: ['mcp__httpDocs__search'],
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Loading MCP servers...');
    expect(lastFrame()).toContain('✓ httpDocs [http] (1 tools)');
  });

  it('shows authentication status for HTTP servers', () => {
    mcpState.statuses = [
      {
        name: 'httpDocs',
        status: 'loaded',
        transportType: 'http',
        authStatus: 'authenticated',
        toolNames: ['mcp__httpDocs__search'],
      },
      {
        name: 'httpDocsLogin',
        status: 'failed',
        transportType: 'http',
        authStatus: 'needs-login',
        toolNames: [],
        error: 'unauthorized',
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('✓ httpDocs [http] [authenticated]');
    expect(lastFrame()).toContain('× httpDocsLogin [http] [needs login]');
  });

  it('refreshes statuses after MCP tools load', async () => {
    mcpState.reloadMcpToolDefinitions.mockImplementationOnce(() => {
      mcpState.statuses = [
        {
          name: 'docs',
          status: 'loaded',
          toolNames: ['mcp__docs__resolve'],
        },
      ];
      return Promise.resolve([]);
    });

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Loading MCP servers...');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('✓ docs (1 tools)');
    });
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('shows MCP tool permission summaries', async () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: [
          'mcp__docs__resolve',
          'mcp__docs__delete',
          'mcp__docs__plan',
        ],
      },
    ];
    mcpState.getMcpToolPermissions.mockImplementation((toolName: string) => ({
      allowedModes:
        toolName === 'mcp__docs__plan'
          ? ['plan', 'safe', 'auto']
          : ['safe', 'auto'],
      autoApprove: toolName === 'mcp__docs__resolve',
      denied: toolName === 'mcp__docs__delete',
    }));

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('1. mcp__docs__resolve (auto-approved)');
    expect(lastFrame()).toContain('2. mcp__docs__delete (denied)');
    expect(lastFrame()).toContain('3. mcp__docs__plan (plan)');
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Loading MCP servers...');
    });
  });

  it('shows MCP config warnings under the affected server', () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve', 'mcp__docs__query_docs'],
        warnings: [
          'permissions.deny references unknown tool "get-library-docs". Available native tool names: resolve, query_docs',
        ],
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('⚠ Warnings');
    expect(lastFrame()).toContain(
      '-permissions.deny references unknown tool "get-library-docs"',
    );
    expect(lastFrame()).toContain('Available native tool names:');
    expect(lastFrame()).toContain('resolve');
    expect(lastFrame()).toContain('query_docs');
  });

  it('shows MCP resources under the affected server', () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [
          {
            uri: 'file:///repo/README.md',
            name: 'README.md',
            title: 'Readme',
            mimeType: 'text/markdown',
          },
          {
            uri: 'file:///repo/package.json',
            name: 'package.json',
            mimeType: 'application/json',
          },
        ],
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Resources (2)');
    expect(lastFrame()).toContain(
      '1. Readme file:///repo/README.md text/markdown',
    );
    expect(lastFrame()).toContain('2. package.json file:///repo/package.json');
  });

  it('omits MCP resources section when no resources are loaded', () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [],
      },
    ];

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).not.toContain('Resources');
  });

  it('selects resources and previews the selected resource on Enter', async () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [
          {
            uri: 'file:///repo/README.md',
            name: 'README.md',
            title: 'Readme',
            mimeType: 'text/markdown',
          },
          {
            uri: 'file:///repo/package.json',
            name: 'package.json',
          },
        ],
      },
    ];
    let resolveRead:
      | ((
          value:
            | {
                content: {
                  uri: string;
                  content: string;
                  isBinary: boolean;
                  mimeType?: string;
                }[];
              }
            | { error: string },
        ) => void)
      | undefined;
    mcpState.readMcpResource.mockImplementation(
      (uri: string) =>
        new Promise((resolve) => {
          resolveRead = resolve;
          void uri;
        }),
    );

    const { lastFrame, stdin } = renderWithTheme(
      <McpStatus onClose={vi.fn()} />,
    );

    expect(lastFrame()).toContain('› 1. Readme file:///repo/README.md');

    stdin.write(KEY.DOWN);
    await time.tick();

    expect(lastFrame()).toContain(
      '› 2. package.json file:///repo/package.json',
    );

    stdin.write(KEY.ENTER);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Loading resource...');
    });
    resolveRead?.({
      content: [
        {
          uri: 'file:///repo/package.json',
          content: '{"name":"code-ollama"}',
          isBinary: false,
        },
      ],
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Resource Preview');
      expect(lastFrame()).toContain('package.json file:///repo/package.json');
      expect(lastFrame()).toContain('{"name":"code-ollama"}');
    });
    expect(mcpState.readMcpResource).toHaveBeenCalledWith(
      'file:///repo/package.json',
    );
  });

  it('wraps resource selection with arrow keys', async () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [
          { uri: 'file:///a.md', name: 'a.md' },
          { uri: 'file:///b.md', name: 'b.md' },
        ],
      },
    ];

    const { lastFrame, stdin } = renderWithTheme(
      <McpStatus onClose={vi.fn()} />,
    );

    stdin.write(KEY.DOWN);
    await time.tick();
    expect(lastFrame()).toContain('› 2. b.md file:///b.md');

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('› 1. a.md file:///a.md');

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('› 2. b.md file:///b.md');

    stdin.write(KEY.DOWN);
    await time.tick();
    expect(lastFrame()).toContain('› 1. a.md file:///a.md');
  });

  it('shows MCP resource read errors in the preview', async () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [{ uri: 'file:///repo/README.md', name: 'README.md' }],
      },
    ];
    mcpState.readMcpResource.mockResolvedValueOnce({ error: 'read failed' });

    const { lastFrame, stdin } = renderWithTheme(
      <McpStatus onClose={vi.fn()} />,
    );

    stdin.write(KEY.ENTER);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Failed to read resource: read failed');
    });
  });

  it('closes resource preview before closing MCP status', async () => {
    const onClose = vi.fn();
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [{ uri: 'file:///repo/README.md', name: 'README.md' }],
      },
    ];

    const { lastFrame, stdin } = renderWithTheme(
      <McpStatus onClose={onClose} />,
    );

    stdin.write(KEY.ENTER);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Resource Preview');
    });

    stdin.write(KEY.ESCAPE);
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Resource Preview');
    });
    expect(onClose).not.toHaveBeenCalled();

    stdin.write(KEY.ESCAPE);

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('ignores regular keyboard input while resource preview is open', async () => {
    const onClose = vi.fn();
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
        resources: [{ uri: 'file:///repo/README.md', name: 'README.md' }],
      },
    ];

    const { lastFrame, stdin } = renderWithTheme(
      <McpStatus onClose={onClose} />,
    );

    stdin.write(KEY.ENTER);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Resource Preview');
    });

    stdin.write('x');
    await time.tick();

    expect(lastFrame()).toContain('Resource Preview');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not read resources when no resources are selectable', async () => {
    mcpState.statuses = [
      {
        name: 'docs',
        status: 'loaded',
        toolNames: ['mcp__docs__resolve'],
      },
    ];

    const { stdin } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(mcpState.readMcpResource).not.toHaveBeenCalled();
  });

  it('settles loading state when MCP refresh rejects', async () => {
    mcpState.reloadMcpToolDefinitions.mockRejectedValueOnce(
      new Error('refresh failed'),
    );

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Loading MCP servers...');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No MCP servers configured.');
    });
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('does not update statuses after unmount', async () => {
    let resolveTools: (() => void) | undefined;
    mcpState.reloadMcpToolDefinitions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTools = () => {
            mcpState.statuses = [
              {
                name: 'docs',
                status: 'loaded',
                toolNames: ['mcp__docs__resolve'],
              },
            ];
            resolve([]);
          };
        }),
    );

    const { lastFrame, unmount } = renderWithTheme(
      <McpStatus onClose={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Loading MCP servers...');
    unmount();
    resolveTools?.();
    await time.tick();

    expect(mcpState.getMcpServerStatuses).toHaveBeenCalledTimes(1);
    mcpState.reloadMcpToolDefinitions.mockResolvedValue([]);
  });

  it('closes on Escape and Ctrl+C', async () => {
    const onClose = vi.fn();
    const { stdin } = renderWithTheme(<McpStatus onClose={onClose} />);

    stdin.write(KEY.ESCAPE);
    await time.tick();
    stdin.write(KEY.CTRL_C);
    await time.tick();

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores regular keyboard input', async () => {
    const onClose = vi.fn();
    const { stdin } = renderWithTheme(<McpStatus onClose={onClose} />);

    stdin.write('x');
    await time.tick();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows comma-separated multiple permission labels', () => {
    mcpState.statuses = [
      {
        name: 'multi-perm',
        status: 'loaded',
        toolNames: ['mcp__multi__perm'],
      },
    ];
    mcpState.getMcpToolPermissions.mockReturnValue({
      allowedModes: ['plan', 'safe', 'auto'],
      autoApprove: true,
      denied: true,
    });

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain(
      '1. mcp__multi__perm (denied, auto-approved, plan)',
    );
  });
});
