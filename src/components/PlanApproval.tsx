import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { MODE } from '../constants';
import type { Mode } from '../types';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  planContent: string;
  onModeChange: (mode: Mode) => void;
}

const options = [
  { label: 'Auto - Execute tools automatically', value: MODE.AUTO },
  { label: 'Safe - Approve each tool', value: MODE.SAFE },
  { label: 'Cancel - Continue planning', value: MODE.PLAN },
];

export function PlanApproval({ planContent, onModeChange }: Props) {
  const handleChange = useCallback(
    (value: string) => {
      onModeChange(value as Mode);
    },
    [onModeChange],
  );

  const handleEscape = useCallback(() => {
    onModeChange(MODE.PLAN);
  }, [onModeChange]);

  return (
    <Box marginX={2}>
      <SelectPrompt
        borderStyle="bold"
        options={options}
        onChange={handleChange}
        onCancel={handleEscape}
      >
        <Box flexDirection="column">
          <Text bold color="magenta">
            Plan Generated - Choose execution mode:
          </Text>

          <Box marginY={1}>
            <Text>{planContent}</Text>
          </Box>

          <SelectPromptHint message="Select execution mode" />
        </Box>
      </SelectPrompt>
    </Box>
  );
}
