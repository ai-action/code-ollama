import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { DECISION, UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { Decision } from '@/types';
import type { ToolCall } from '@/utils/ollama';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  toolCall: ToolCall;
  onDecision: (decision: Decision) => void;
}

const options: { label: string; value: Decision }[] = [
  { label: 'Approve tool call', value: DECISION.APPROVE },
  { label: 'Reject tool call', value: DECISION.REJECT },
];

export function ToolApproval({ toolCall, onDecision }: Props) {
  const theme = useTheme();
  const handleChange = useCallback(
    (value: string) => {
      onDecision(value as Decision);
    },
    [onDecision],
  );

  const handleEscape = useCallback(() => {
    onDecision(DECISION.REJECT);
  }, [onDecision]);

  const args = JSON.stringify(toolCall.function.arguments, null, 2);

  return (
    <Box marginX={UI.SCREEN_MARGIN_X}>
      <SelectPrompt
        borderStyle="bold"
        options={options}
        onChange={handleChange}
        onCancel={handleEscape}
      >
        <Text color={theme.colors.warning}>
          Tool requires approval {UI.WARNING}{' '}
        </Text>

        <Box flexDirection="column" marginBottom={1} marginX={2}>
          <Text>
            <Text dimColor>Tool:</Text> {toolCall.function.name}
          </Text>
          <Text>
            <Text dimColor>Arguments:</Text> {args}
          </Text>
        </Box>

        <SelectPromptHint
          message="Select approval action"
          escapeLabel="reject"
        />
      </SelectPrompt>
    </Box>
  );
}
