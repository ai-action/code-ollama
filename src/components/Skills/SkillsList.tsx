import { Box, Text } from 'ink';

import { useTheme } from '@/contexts';
import type { Skill } from '@/utils/skills';

interface Props {
  items: Skill[];
  label: string;
}

export function SkillsList({ items, label }: Props) {
  const theme = useTheme();

  if (!items.length) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.colors.accent}>{label}:</Text>

      {items.map(({ description, name }) => (
        <Box key={name} flexDirection="column">
          <Text>- {name}</Text>

          {description && (
            <Box marginX={2}>
              <Text dimColor italic>
                {description}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
