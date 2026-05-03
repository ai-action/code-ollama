import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import type { ToolCall } from '../utils/ollama';

interface Props {
  toolCall: ToolCall;
  onApprove: () => void;
  onReject: () => void;
}

export function ToolApproval({ toolCall, onApprove, onReject }: Props) {
  const [selected, setSelected] = useState<'yes' | 'no'>('yes');

  useInput((_, key) => {
    if (key.return) {
      if (selected === 'yes') {
        onApprove();
      } else {
        onReject();
      }
      // v8 ignore start
    } else if (key.leftArrow || key.rightArrow) {
      setSelected((prev) => (prev === 'yes' ? 'no' : 'yes'));
    }
    // v8 ignore stop
  });

  const args = JSON.stringify(toolCall.function.arguments, null, 2);

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="yellow" bold>
        ⚠️ Tool requires approval:
      </Text>
      <Box marginX={2} flexDirection="column">
        <Text>
          <Text bold>Tool:</Text> {toolCall.function.name}
        </Text>
        <Text>
          <Text bold>Arguments:</Text> {args}
        </Text>
      </Box>
      <Box marginTop={1} gap={2}>
        <Text>
          <Text color={selected === 'yes' ? 'green' : undefined}>
            {selected === 'yes' ? '▶ ' : '  '}✓ Yes (Enter)
          </Text>
        </Text>
        <Text>
          <Text color={selected === 'no' ? 'red' : undefined}>
            {selected === 'no' ? '▶ ' : '  '}✗ No (Esc)
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
