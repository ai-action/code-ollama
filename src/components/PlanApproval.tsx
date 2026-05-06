import { Select } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback } from 'react';

import { MODE } from '../constants';

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
  useInput((_, key) => {
    if (key.escape) {
      onModeChange(MODE.NAME.PLAN);
    }
  });

  const handleChange = useCallback(
    (value: string) => {
      onModeChange(value as MODE.Name);
    },
    [onModeChange],
  );

  return (
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

      <Select options={options} onChange={handleChange} />
    </Box>
  );
}
