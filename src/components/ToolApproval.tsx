import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { DECISION } from '../constants';
import type { ToolCall } from '../utils/ollama';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  toolCall: ToolCall;
  onDecision: (decision: DECISION.Decision) => void;
}

const options: { label: string; value: DECISION.Decision }[] = [
  { label: 'Approve tool call', value: DECISION.APPROVE },
  { label: 'Reject tool call', value: DECISION.REJECT },
];

export function ToolApproval({ toolCall, onDecision }: Props) {
  const handleChange = useCallback(
    (value: string) => {
      onDecision(value as DECISION.Decision);
    },
    [onDecision],
  );

  const handleEscape = useCallback(() => {
    onDecision(DECISION.REJECT);
  }, [onDecision]);

  const args = JSON.stringify(toolCall.function.arguments, null, 2);

  return (
    <SelectPrompt
      options={options}
      onChange={handleChange}
      onEscape={handleEscape}
    >
      <Text color="yellow">⚠️ Tool requires approval:</Text>

      <Box marginX={3} marginBottom={1} flexDirection="column">
        <Text>
          <Text italic>Tool:</Text> {toolCall.function.name}
        </Text>
        <Text>
          <Text italic>Arguments:</Text> {args}
        </Text>
      </Box>

      <SelectPromptHint message="Select approval action" escapeLabel="reject" />
    </SelectPrompt>
  );
}
