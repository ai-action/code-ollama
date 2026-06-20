import { Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { ExitHint } from '@/components/ExitHint';
import { useTheme } from '@/contexts';
import { mcp } from '@/utils';

interface Props {
  onClose: () => void;
}

export function McpStatus({ onClose }: Props) {
  const theme = useTheme();
  const [statuses, setStatuses] = useState<mcp.McpServerStatus[]>(() =>
    mcp.getMcpServerStatuses(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void mcp
      .reloadMcpToolDefinitions()
      .catch(() => {
        // Statuses already preserve per-server MCP failures.
      })
      .then(() => {
        if (isMounted) {
          setStatuses(mcp.getMcpServerStatuses());
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onClose();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline>
          MCP Servers
        </Text>
      </Box>

      {isLoading && (
        <Box marginBottom={1}>
          <Spinner label="Loading MCP servers..." />
        </Box>
      )}

      {!statuses.length && !isLoading ? (
        <Text dimColor>No MCP servers configured.</Text>
      ) : (
        statuses.map((server) => (
          <Box key={server.name} flexDirection="column" marginBottom={1}>
            <Text>
              <Text
                color={getStatusColor(server.status, theme)}
                dimColor={server.status === 'disabled'}
              >
                {getStatusSymbol(server.status)}
              </Text>{' '}
              {server.name}
              {server.status === 'loaded' && (
                <Text dimColor> ({String(server.toolNames.length)} tools)</Text>
              )}
            </Text>

            {server.status === 'disabled' && <Text dimColor>disabled</Text>}

            {server.status === 'failed' && (
              <Text color={theme.colors.error}>Error: {server.error}</Text>
            )}

            {server.toolNames.map((toolName, index) => (
              <Text key={toolName} dimColor>
                {index + 1}. {toolName}
                {renderPermissionSummary(toolName)}
              </Text>
            ))}

            {!!server.warnings?.length && (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.colors.warning}>⚠ Warnings</Text>
                {server.warnings.map((warning) => (
                  <Box key={warning} flexDirection="row">
                    <Text dimColor>- </Text>
                    <Text dimColor>{warning}</Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))
      )}

      <ExitHint />
    </Box>
  );
}

function renderPermissionSummary(toolName: string): React.ReactNode {
  const permissions = mcp.getMcpToolPermissions(toolName);

  const labels = [
    permissions.denied ? 'denied' : undefined,
    permissions.autoApprove ? 'auto-approved' : undefined,
    permissions.allowedModes.includes('plan') ? 'plan' : undefined,
  ].filter(Boolean);

  if (!labels.length) {
    return null;
  }

  return (
    <Text>
      {' '}
      (
      {labels.map((label, index) => (
        <Text key={index}>
          <Text italic>{label}</Text>
          {index + 1 < labels.length && ', '}
        </Text>
      ))}
      )
    </Text>
  );
}

function getStatusSymbol(status: mcp.McpServerStatus['status']): string {
  switch (status) {
    case 'loaded':
      return '✓';
    case 'failed':
      return '×';
    case 'disabled':
      return '○';
  }
}

function getStatusColor(
  status: mcp.McpServerStatus['status'],
  theme: ReturnType<typeof useTheme>,
): string {
  switch (status) {
    case 'loaded':
      return 'green';
    case 'failed':
      return theme.colors.error;
    case 'disabled':
      return theme.colors.secondary;
  }
}
