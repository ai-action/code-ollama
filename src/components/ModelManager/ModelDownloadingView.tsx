import { ProgressBar } from '@inkjs/ui';
import { Box, Text } from 'ink';

import type { ThemeDefinition } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import type { DownloadProgressState } from './types';
import { formatBytes } from './utils';

interface Props {
  progress: DownloadProgressState;
  theme: ThemeDefinition;
  onCancel: () => void;
}

export function ModelDownloadingView({ progress, theme, onCancel }: Props) {
  const percent =
    progress.total > 0 &&
    Number.isFinite(progress.completed) &&
    Number.isFinite(progress.total)
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  return (
    <Box flexDirection="column">
      <Text>
        Downloading model:{' '}
        <Text color={theme.colors.model}>{progress.model}</Text>
      </Text>

      <Text>{progress.status}</Text>

      {percent !== null ? (
        <>
          <Text>
            {percent}% ({formatBytes(progress.completed)} /{' '}
            {formatBytes(progress.total)})
          </Text>
          <ProgressBar value={Math.max(0, Math.min(100, percent))} />
        </>
      ) : (
        <Text color={theme.colors.secondary} dimColor>
          Progress details unavailable. Waiting for Ollama updates...
        </Text>
      )}

      <SelectPrompt
        options={[{ label: 'Cancel download', value: 'cancel-download' }]}
        onCancel={onCancel}
        onChange={onCancel}
      >
        <SelectPromptHint message="Press Enter, Esc, or Ctrl+C to cancel" />
      </SelectPrompt>
    </Box>
  );
}
