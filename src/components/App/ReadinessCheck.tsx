import { Box, Text } from 'ink';

import { ChatInput } from '@/components/Chat';
import { THEME, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';

export enum ReadinessState {
  Checking = 'checking',
  Ready = 'ready',
  MissingModelConfig = 'missing-model-config',
  NoInstalledModels = 'no-installed-models',
  ModelLoadError = 'model-load-error',
}

interface Props {
  errorMessage?: string | null;
  onCommand: (command: string) => void;
  setupState: ReadinessState;
  theme?: ThemeDefinition;
}

function getMessage(
  setupState: ReadinessState,
  errorMessage?: string | null,
): string[] {
  switch (setupState) {
    case ReadinessState.Checking:
      return ['Checking Ollama model setup...'];

    case ReadinessState.MissingModelConfig:
      return [
        `${UI.EXCLAMATION} No model configured.`,
        'Use /model to select or download one.',
      ];

    case ReadinessState.NoInstalledModels:
      return [
        `${UI.EXCLAMATION} No models installed.`,
        'Use /model to download one.',
      ];

    case ReadinessState.ModelLoadError:
      return [
        `${UI.EXCLAMATION} Unable to load models${errorMessage ? `: ${errorMessage}` : ''}`,
        'Fix the connection, then use /model.',
      ];

    case ReadinessState.Ready:
    default:
      return [];
  }
}

export function ReadinessCheck({
  errorMessage,
  onCommand,
  setupState,
  theme = THEME.getTheme(),
}: Props) {
  const message = getMessage(setupState, errorMessage);

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        flexDirection="column"
        marginBottom={1}
        paddingX={1}
        paddingY={1}
      >
        <Text bold color={theme.colors.error}>
          Setup Required
        </Text>

        {message.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </Box>

      <ChatInput history={[]} onSubmit={onCommand} />
    </Box>
  );
}
