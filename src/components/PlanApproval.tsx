import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { MODE } from '../constants';
import { SelectPrompt } from './SelectPrompt';

interface Props {
  planContent: string;
  onModeChange: (mode: MODE.Name) => void;
}

const options = [
  { label: 'Auto - Execute tools automatically', value: MODE.NAME.AUTO },
  { label: 'Safe - Approve each tool', value: MODE.NAME.SAFE },
  { label: 'Cancel - Continue planning', value: MODE.NAME.PLAN },
];

export function PlanApproval({ planContent, onModeChange }: Props) {
  const handleChange = useCallback(
    (value: string) => {
      onModeChange(value as MODE.Name);
    },
    [onModeChange],
  );

  const handleEscape = useCallback(() => {
    onModeChange(MODE.NAME.PLAN);
  }, [onModeChange]);

  return (
    <SelectPrompt
      options={options}
      onChange={handleChange}
      onEscape={handleEscape}
    >
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="magenta">
          Plan Generated - Choose execution mode:
        </Text>

        <Box marginY={1}>
          <Text>{planContent}</Text>
        </Box>

        <Text dimColor>
          Select execution mode (↑↓ + Enter to confirm, Esc to cancel)
        </Text>
      </Box>
    </SelectPrompt>
  );
}
