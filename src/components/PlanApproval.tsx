import { Select } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback } from 'react';

interface Props {
  planContent: string;
  onAuto: () => void;
  onSafe: () => void;
  onCancel: () => void;
}

const options = [
  { label: 'Auto - Execute tools automatically', value: 'auto' as const },
  { label: 'Safe - Approve each tool', value: 'safe' as const },
  { label: 'Cancel - Continue planning', value: 'cancel' as const },
];

export function PlanApproval({ planContent, onAuto, onSafe, onCancel }: Props) {
  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleChange = useCallback((value: string) => {
    switch (value) {
      case 'auto':
        onAuto();
        break;

      case 'safe':
        onSafe();
        break;

      case 'cancel':
        onCancel();
        break;
    }
  }, []);

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
