import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { MODE } from '../constants';
import type { ModeName } from '../types';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  planContent: string;
  onModeChange: (mode: ModeName) => void;
}

const options = [
  { label: 'Auto - Execute tools automatically', value: MODE.AUTO },
  { label: 'Safe - Approve each tool', value: MODE.SAFE },
  { label: 'Cancel - Continue planning', value: MODE.PLAN },
];

export function PlanApproval({ planContent, onModeChange }: Props) {
  const handleChange = useCallback(
    (value: string) => {
      onModeChange(value as ModeName);
    },
    [onModeChange],
  );

  const handleEscape = useCallback(() => {
    onModeChange(MODE.PLAN);
  }, [onModeChange]);

  return (
    <SelectPrompt
      options={options}
      onChange={handleChange}
      onCancel={handleEscape}
    >
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="magenta">
          Plan Generated - Choose execution mode:
        </Text>

        <Box marginY={1}>
          <Text>{planContent}</Text>
        </Box>

        <SelectPromptHint message="Select execution mode" />
      </Box>
    </SelectPrompt>
  );
}
