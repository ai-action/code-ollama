import { Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import { ExitHint } from '@/components/ExitHint';
import { KEY } from '@/constants';
import { useTheme } from '@/contexts';
import { mcp } from '@/utils';

interface Props {
  onClose: () => void;
}

interface ResourceOption {
  index: number;
  resource: mcp.McpResourceSummary;
}

type PreviewState =
  | {
      status: 'loading';
      resource: mcp.McpResourceSummary;
    }
  | {
      status: 'loaded';
      resource: mcp.McpResourceSummary;
      content: mcp.McpResourceContent[];
    }
  | {
      status: 'failed';
      resource: mcp.McpResourceSummary;
      error: string;
    };

export function McpStatus({ onClose }: Props) {
  const theme = useTheme();
  const [statuses, setStatuses] = useState<mcp.McpServerStatus[]>(() =>
    mcp.getMcpServerStatuses(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewState>();

  const resourceOptions = useMemo(
    () => getResourceOptions(statuses),
    [statuses],
  );

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

  useEffect(() => {
    setSelectedResourceIndex((current) =>
      resourceOptions.length
        ? Math.min(current, resourceOptions.length - 1)
        : 0,
    );
  }, [resourceOptions.length]);

  useInput((input, key) => {
    const isEscape = key.escape || input === KEY.ESCAPE;
    const isCtrlC = (key.ctrl && input === 'c') || input === KEY.CTRL_C;

    if (preview && (isEscape || isCtrlC)) {
      setPreview(undefined);
      return;
    }

    if (preview) {
      return;
    }

    if ((key.upArrow || input === KEY.UP) && resourceOptions.length) {
      setSelectedResourceIndex((current) =>
        current === 0 ? resourceOptions.length - 1 : current - 1,
      );
      return;
    }

    if ((key.downArrow || input === KEY.DOWN) && resourceOptions.length) {
      setSelectedResourceIndex((current) =>
        current + 1 >= resourceOptions.length ? 0 : current + 1,
      );
      return;
    }

    if ((key.return || input === KEY.ENTER) && resourceOptions.length) {
      const selected = resourceOptions[selectedResourceIndex];

      const { resource } = selected;
      setPreview({ status: 'loading', resource });
      void mcp.readMcpResource(resource.uri).then((result) => {
        if ('error' in result) {
          setPreview({ status: 'failed', resource, error: result.error });
          return;
        }

        setPreview({
          status: 'loaded',
          resource,
          content: result.content,
        });
      });
      return;
    }

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

            {server.status === 'loaded' && !!server.resources?.length && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>
                  Resources ({String(server.resources.length)})
                </Text>
                {server.resources.map((resource, index) => {
                  const resourceIndex = resourceOptions.findIndex(
                    (option) => option.resource === resource,
                  );
                  const isSelected = resourceIndex === selectedResourceIndex;

                  return (
                    <Text
                      key={resource.uri}
                      color={isSelected ? theme.colors.accent : undefined}
                      dimColor={!isSelected}
                    >
                      {isSelected ? '› ' : '  '}
                      {index + 1}. {resource.title ?? resource.name}{' '}
                      {resource.uri}
                      {resource.mimeType && <Text> {resource.mimeType}</Text>}
                    </Text>
                  );
                })}
              </Box>
            )}

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

      {preview && <ResourcePreview preview={preview} />}

      <ExitHint />
    </Box>
  );
}

function getResourceOptions(statuses: mcp.McpServerStatus[]): ResourceOption[] {
  const options: ResourceOption[] = [];

  for (const server of statuses) {
    if (server.status !== 'loaded' || !server.resources?.length) {
      continue;
    }

    for (const resource of server.resources) {
      options.push({ index: options.length, resource });
    }
  }

  return options;
}

function ResourcePreview({ preview }: { preview: PreviewState }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold underline>
        Resource Preview
      </Text>
      <Text>
        {preview.resource.title ?? preview.resource.name}{' '}
        <Text dimColor>{preview.resource.uri}</Text>
      </Text>
      <Text dimColor>{preview.resource.mimeType ?? ''}</Text>

      {preview.status === 'loading' && <Spinner label="Loading resource..." />}

      {preview.status === 'failed' && (
        <Text color="red">Failed to read resource: {preview.error}</Text>
      )}

      {preview.status === 'loaded' &&
        preview.content.map((content, index) => (
          <Box
            key={`${content.uri}:${String(index)}`}
            flexDirection="column"
            marginTop={1}
          >
            <Text dimColor>
              {content.uri}
              {content.mimeType ? <Text> {content.mimeType}</Text> : ''}
            </Text>
            <Text>{content.content}</Text>
          </Box>
        ))}
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
