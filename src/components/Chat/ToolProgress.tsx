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
    <Box flexDirection="column" marginTop={1}>
      {progress.map(({ index, name, status }) => (
        <Text
          color={status === 'failed' ? colors.error : undefined}
          key={`${String(index)}-${name}`}
        >
          {status === 'running' ? frame : UI.DIAMOND} {name}: {status}
        </Text>
      ))}
    </Box>
  );
}
