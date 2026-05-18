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
): React.ReactNode {
  switch (setupState) {
    case ReadinessState.Checking:
      return <Text>Checking Ollama model setup...</Text>;

    case ReadinessState.MissingModelConfig:
      return (
        <>
          <Text>{UI.EXCLAMATION} No model configured.</Text>
          <Text>Use /model to select or download one.</Text>
        </>
      );

    case ReadinessState.NoInstalledModels:
      return (
        <>
          <Text>{UI.EXCLAMATION} No models installed.</Text>
          <Text>Use /model to download one.</Text>
        </>
      );

    case ReadinessState.ModelLoadError:
      return (
        <>
          <Text>
            {UI.EXCLAMATION} Unable to load models
            {errorMessage ? `: ${errorMessage}` : ''}
          </Text>
          <Text>Fix the connection, then use /model.</Text>
        </>
      );

    case ReadinessState.Ready:
    default:
      return null;
  }
}

export function ReadinessCheck({
  errorMessage,
  onCommand,
  setupState,
  theme = THEME.getTheme(),
}: Props) {
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

        {getMessage(setupState, errorMessage)}
      </Box>

      <ChatInput history={[]} onSubmit={onCommand} />
    </Box>
  );
}
