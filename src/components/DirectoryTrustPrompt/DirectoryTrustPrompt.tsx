import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { UI } from '@/constants';
import { useTheme } from '@/contexts';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  directory: string;
  onDecision: (isTrusted: boolean) => void;
}

const VALUE = {
  TRUST: 'trust',
  EXIT: 'exit',
} as const;

const options = [
  { label: 'Yes, trust and continue', value: VALUE.TRUST },
  { label: 'No, exit', value: VALUE.EXIT },
];

export function DirectoryTrustPrompt({ directory, onDecision }: Props) {
  const theme = useTheme();
  const handleChange = useCallback(
    (value: string) => {
      onDecision(value === VALUE.TRUST);
    },
    [onDecision],
  );

  const handleCancel = useCallback(() => {
    onDecision(false);
  }, [onDecision]);

  return (
    <SelectPrompt
      borderStyle="bold"
      onCancel={handleCancel}
      onChange={handleChange}
      options={options}
    >
      <Box flexDirection="column" marginBottom={1} marginX={UI.SCREEN_MARGIN_X}>
        <Text color={theme.colors.warning}>
          {UI.WARNING} Trust this directory?{' '}
          <Text color={theme.colors.accent}>{directory}</Text>
        </Text>

        <Box marginY={1}>
          <Text>
            Code Ollama may read project files (e.g., AGENTS.md) and those files
            can influence the assistant. Only continue if you trust this
            workspace; untrusted content can attempt{' '}
            <Text bold italic>
              prompt injection
            </Text>
            .
          </Text>
        </Box>

        <SelectPromptHint escapeLabel="exit" />
      </Box>
    </SelectPrompt>
  );
}
