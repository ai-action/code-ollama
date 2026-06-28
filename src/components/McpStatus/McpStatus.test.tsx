import { Text } from 'ink';

import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { McpStatus } from './McpStatus';

const mcpState = vi.hoisted(() => ({
  statuses: [] as {
    name: string;
    status: 'loaded' | 'disabled' | 'failed';
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
    this.reloadMcpToolDefinitions.mockClear();
    this.reloadMcpToolDefinitions.mockResolvedValue([]);
  },
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  mcp: {
    getMcpServerStatuses: mcpState.getMcpServerStatuses,
    getMcpToolPermissions: mcpState.getMcpToolPermissions,
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
