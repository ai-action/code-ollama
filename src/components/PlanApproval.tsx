import { Box, Text, useInput } from 'ink';

interface Props {
  planContent: string;
  onAuto: () => void;
  onSafe: () => void;
  onCancel: () => void;
}

export function PlanApproval({ planContent, onAuto, onSafe, onCancel }: Props) {
  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    const lowerInput = input.toLowerCase();
    if (lowerInput === 'a') {
      onAuto();
    } else if (lowerInput === 's') {
      onSafe();
    } else if (lowerInput === 'c' || (key.return && lowerInput === '')) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="magenta">
        Plan Generated - Choose execution mode:
      </Text>

      <Box marginY={1}>
        <Text>{planContent}</Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold color="green">
            [A]
          </Text>{' '}
          Auto - Execute all tools automatically
        </Text>
        <Text>
          <Text bold color="yellow">
            [S]
          </Text>{' '}
          Safe - Approve each tool individually
        </Text>
        <Text>
          <Text bold color="gray">
            [C]
          </Text>{' '}
          Cancel / Esc - Abort plan execution
        </Text>
      </Box>
    </Box>
  );
}
