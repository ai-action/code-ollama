import { Select } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback } from 'react';

import { DECISION } from '../constants';
import type { ToolCall } from '../utils/ollama';

interface Props {
  toolCall: ToolCall;
  onDecision: (decision: DECISION.Decision) => void;
}

const options: { label: string; value: DECISION.Decision }[] = [
  { label: 'Approve tool call', value: DECISION.APPROVE },
  { label: 'Reject tool call', value: DECISION.REJECT },
];

export function ToolApproval({ toolCall, onDecision }: Props) {
  useInput((_, key) => {
    if (key.escape) {
      onDecision(DECISION.REJECT);
    }
  });

  const handleChange = useCallback(
    (value: string) => {
      onDecision(value as DECISION.Decision);
    },
    [onDecision],
  );

  const args = JSON.stringify(toolCall.function.arguments, null, 2);

  return (
    <Box flexDirection="column">
      <Text color="yellow">⚠️ Tool requires approval:</Text>

      <Box marginX={3} marginBottom={1} flexDirection="column">
        <Text>
          <Text italic>Tool:</Text> {toolCall.function.name}
        </Text>
        <Text>
          <Text italic>Arguments:</Text> {args}
        </Text>
      </Box>

      <Text dimColor>
        Select approval action (↑↓ + Enter to confirm, Esc to reject)
      </Text>

      <Select options={options} onChange={handleChange} />
    </Box>
  );
}
