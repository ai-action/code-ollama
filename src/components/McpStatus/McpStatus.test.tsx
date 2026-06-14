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

describe('McpStatus', () => {
  beforeEach(() => {
    mcpState.reset();
  });

  it('shows empty state when no MCP servers are configured', () => {
    const { lastFrame } = renderWithTheme(<McpStatus onClose={vi.fn()} />);

    expect(lastFrame()).toContain('MCP Servers');
    expect(lastFrame()).toContain('No MCP servers configured.');
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

    expect(lastFrame()).toContain('loaded docs (2 tools)');
    expect(lastFrame()).toContain('- mcp__docs__resolve');
    expect(lastFrame()).toContain('- mcp__docs__search');
    expect(lastFrame()).toContain('disabled disabledDocs');
    expect(lastFrame()).toContain('failed broken');
    expect(lastFrame()).toContain('Error: spawn failed');
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

    expect(lastFrame()).toContain('No MCP servers configured.');
    await time.tick();
    expect(lastFrame()).toContain('loaded docs (1 tools)');
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

    expect(lastFrame()).toContain('No MCP servers configured.');
    unmount();
    resolveTools?.();
    await time.tick();

    expect(mcpState.getMcpServerStatuses).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and Ctrl+C', async () => {
    const onClose = vi.fn();
    const { stdin } = renderWithTheme(<McpStatus onClose={onClose} />);

    stdin.write(KEY.ESCAPE);
    await time.tick();
    stdin.write('\x03');
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
});
