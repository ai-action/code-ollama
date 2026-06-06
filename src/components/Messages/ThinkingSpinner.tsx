import { useSpinner } from '@inkjs/ui';
import { Text, useAnimation } from 'ink';
import { useMemo } from 'react';

import { useTheme } from '@/contexts';

/**
 * Spinner that displays an animated "Thinking..."
 */
export function ThinkingSpinner() {
  const { frame: spinnerFrame } = useSpinner({ type: 'dots' });
  const { frame: animationFrame } = useAnimation({ interval: 300 });
  const { colors } = useTheme();
  const dots = useMemo(() => '.'.repeat(animationFrame % 4), [animationFrame]);

  return (
    <Text>
      <Text color={colors.accent}>{spinnerFrame}</Text> Thinking{dots}
    </Text>
  );
}
