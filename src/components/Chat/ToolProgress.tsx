import { useSpinner } from '@inkjs/ui';
import { Box, Text } from 'ink';

import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { ollama } from '@/utils';

interface Props {
  progress: ollama.ToolCallProgress[];
}

export function ToolProgress({ progress }: Props) {
  const { frame } = useSpinner({ type: 'dots' });
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" marginTop={1} marginX={UI.SCREEN_MARGIN_X}>
      <Text>
        <Text color={colors.accent}>{frame}</Text> Processing{' '}
        {String(progress.length)} tool{' '}
        {progress.length === 1 ? 'call' : 'calls'}
      </Text>
    </Box>
  );
}
