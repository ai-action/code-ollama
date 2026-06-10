import { Box, Text } from 'ink';

import { ChatInput } from '@/components/Chat';
import { Link } from '@/components/Link';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { ThemeDefinition } from '@/types';

export enum ReadinessState {
  Checking = 'checking',
  Ready = 'ready',
  MissingModelConfig = 'missing-model-config',
  NoInstalledModels = 'no-installed-models',
  ServerUnavailable = 'server-unavailable',
  ModelLoadError = 'model-load-error',
}

interface Props {
  errorMessage?: string | null;
  onCommand: (command: string) => void;
  setupState: ReadinessState;
}

function getTitle(setupState: ReadinessState): string | undefined {
  switch (setupState) {
    case ReadinessState.ServerUnavailable:
      return 'Ollama Server Unavailable';

    case ReadinessState.ModelLoadError:
      return 'Connection Error';

    case ReadinessState.MissingModelConfig:
      return 'No Model Configured';

    case ReadinessState.NoInstalledModels:
      return 'No Model Installed';
  }
}

function getMessage(
  setupState: ReadinessState,
  theme: ThemeDefinition,
  errorMessage?: string | null,
): React.ReactNode {
  switch (setupState) {
    case ReadinessState.Checking:
      return <Text>Checking Ollama server and model setup...</Text>;

    case ReadinessState.MissingModelConfig:
      return (
        <Text>
          Select or download a model with{' '}
          <Text color={theme.colors.command}>/models</Text>
        </Text>
      );

    case ReadinessState.NoInstalledModels:
      return (
        <Text>
          Download a model with{' '}
          <Text color={theme.colors.command}>/models</Text>
        </Text>
      );

    case ReadinessState.ServerUnavailable:
      return (
        <>
          <Text>Ollama server is unreachable or not running.</Text>
          <Text>
            Start it with <Text color={theme.colors.command}>ollama serve</Text>
            . If it's not installed, download it from{' '}
            <Link href="https://ollama.com/download" dimColor />
          </Text>
        </>
      );

    case ReadinessState.ModelLoadError:
      return (
        <>
          <Text>
            Error loading models{errorMessage ? `: ${errorMessage}` : ''}.
          </Text>

          <Text>Fix the connection and restart the app</Text>
        </>
      );

    case ReadinessState.Ready:
    default:
      return null;
  }
}

export function ReadinessCheck({ errorMessage, onCommand, setupState }: Props) {
  const theme = useTheme();
  const title = getTitle(setupState);

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="bold"
        flexDirection="column"
        marginBottom={1}
        paddingX={1}
        paddingY={1}
      >
        {title && (
          <Text bold color={theme.colors.error}>
            {UI.EXCLAMATION} {title}
          </Text>
        )}

        {getMessage(setupState, theme, errorMessage)}
      </Box>

      <ChatInput
        history={[]}
        onSubmit={({ content }) => {
          onCommand(content);
        }}
      />
    </Box>
  );
}
