import { Box, Text } from 'ink';

interface SelectPromptHintProps {
  message?: string;
  escapeLabel?: string;
}

export function SelectPromptHint({
  message = 'Select option',
  escapeLabel = 'cancel',
}: SelectPromptHintProps) {
  return (
    // Select option (↑↓ + Enter to confirm, Esc to cancel)
    <Box flexDirection="row">
      <Text dimColor>{message} (</Text>
      <Text bold>↑↓</Text>
      <Text dimColor> + </Text>
      <Text bold>Enter</Text>
      <Text dimColor> to confirm, </Text>
      <Text bold>Esc</Text>
      <Text dimColor> to {escapeLabel})</Text>
    </Box>
  );
}
