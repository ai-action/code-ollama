import { Text } from 'ink';

import { useTheme } from '@/contexts';

interface ExitHintProps {
  action?: string;
}

/**
 * Exit hint component that displays:
 * Press Esc/Ctrl+C to go back.
 */
export function ExitHint({ action = 'go back' }: ExitHintProps) {
  const theme = useTheme();

  return (
    <Text color={theme.colors.secondary}>
      <Text dimColor>Press </Text>
      <Text bold>Esc</Text>
      <Text dimColor>/</Text>
      <Text bold>Ctrl+C</Text>
      <Text dimColor> to {action}.</Text>
    </Text>
  );
}
