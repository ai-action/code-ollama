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
  }[],
  getMcpServerStatuses: vi.fn(() => mcpState.statuses),
  getMcpToolDefinitions: vi.fn(() => Promise.resolve([])),
  reset() {
    this.statuses = [];
    this.getMcpServerStatuses.mockClear();
    this.getMcpToolDefinitions.mockClear();
    this.getMcpToolDefinitions.mockResolvedValue([]);
  },
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  mcp: {
    getMcpServerStatuses: mcpState.getMcpServerStatuses,
    getMcpToolDefinitions: mcpState.getMcpToolDefinitions,
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
    await time.tick(10);
    expect(lastFrame()).toContain('No MCP servers configured.');
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('shows loaded, disabled, and failed server statuses', async () => {
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
    expect(lastFrame()).toContain('- mcp__docs__resolve');
    expect(lastFrame()).toContain('- mcp__docs__search');
    expect(lastFrame()).toContain('– disabledDocs');
    expect(lastFrame()).toContain('disabled');
    expect(lastFrame()).toContain('× broken');
    expect(lastFrame()).toContain('Error: spawn failed');
    await time.tick(10);
  });

  it('refreshes statuses after MCP tools load', async () => {
    mcpState.getMcpToolDefinitions.mockImplementationOnce(() => {
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
    await time.tick(10);
    expect(lastFrame()).toContain('✓ docs (1 tools)');
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('settles loading state when MCP refresh rejects', async () => {
    mcpState.getMcpToolDefinitions.mockRejectedValueOnce(
      new Error('refresh failed'),
    );

    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Loading MCP servers...');
    await time.tick(10);
    expect(lastFrame()).toContain('No MCP servers configured.');
    expect(lastFrame()).not.toContain('Loading MCP servers...');
  });

  it('does not update statuses after unmount', async () => {
    let resolveTools: (() => void) | undefined;
    mcpState.getMcpToolDefinitions.mockImplementationOnce(
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
    mcpState.getMcpToolDefinitions.mockResolvedValue([]);
  });

  it('closes on Escape and Ctrl+C', async () => {
    const onClose = vi.fn();
    const { stdin } = renderWithTheme(<McpStatus onClose={onClose} />);

    stdin.write(KEY.ESCAPE);
    await time.tick();
    stdin.write(KEY.CTRL_C);
    await time.tick();

    expect(onClose).toHaveBeenCalledTimes(2);
    await time.tick(10);
  });

  it('ignores regular keyboard input', async () => {
    const onClose = vi.fn();
    const { stdin } = renderWithTheme(<McpStatus onClose={onClose} />);

    stdin.write('x');
    await time.tick();

    expect(onClose).not.toHaveBeenCalled();
    await time.tick(10);
  });
});
