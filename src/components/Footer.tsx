import { Box, Text, useInput } from 'ink';

interface Props {
  autoExecute: boolean;
  onToggleMode: () => void;
}

export function Footer({ autoExecute, onToggleMode }: Props) {
  // Keyboard shortcut to toggle auto-execute mode
  useInput((_, key) => {
    if (key.tab && key.shift) {
      onToggleMode();
    }
  });

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Text dimColor>
        Mode: {autoExecute ? 'Auto' : 'Safe'} (Shift+Tab to toggle)
      </Text>
    </Box>
  );
}
