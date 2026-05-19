import { Text } from 'ink';

import { THEME } from '@/constants';

interface ExitHintProps {
  action?: string;
}

export function ExitHint({ action = 'go back' }: ExitHintProps) {
  const theme = THEME.getTheme();

  return (
    <Text color={theme.colors.secondary} dimColor>
      Press Esc or Ctrl+C to {action}.
    </Text>
  );
}
