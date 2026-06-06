import { Text } from 'ink';

import { useTheme } from '@/contexts';

interface SelectPromptHintProps {
  message?: string;
  escapeLabel?: string;
}

/**
 * Select prompt hint component that displays:
 * Select option (↑↓ + Enter to confirm, Esc/Ctrl+C to cancel)
 */
export function SelectPromptHint({
  message = 'Select option',
  escapeLabel = 'cancel',
}: SelectPromptHintProps) {
  const theme = useTheme();

  return (
    <Text color={theme.colors.secondary}>
      <Text dimColor>{message} (</Text>
      <Text bold>↑↓</Text>
      <Text dimColor> + </Text>
      <Text bold>Enter</Text>
      <Text dimColor> to confirm, </Text>
      <Text bold>Esc</Text>
      <Text dimColor>/</Text>
      <Text bold>Ctrl+C</Text>
      <Text dimColor> to {escapeLabel})</Text>
    </Text>
  );
}
