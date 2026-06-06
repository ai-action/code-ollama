import { Box, Text, useInput } from 'ink';
import { useMemo } from 'react';

import { ExitHint } from '@/components';
import { useTheme } from '@/contexts';
import { skills as skillsUtils } from '@/utils';

interface Props {
  onClose: () => void;
}

export function Skills({ onClose }: Props) {
  const theme = useTheme();
  const loadedSkills = useMemo(() => skillsUtils.loadSkills(), []);
  const projectSkills = loadedSkills.filter(
    ({ source }) => source === 'project',
  );
  const userSkills = loadedSkills.filter(({ source }) => source === 'user');

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onClose();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Skills</Text>

      {!loadedSkills.length ? (
        <Text color={theme.colors.secondary}>No skills loaded.</Text>
      ) : (
        <>
          {projectSkills.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.colors.status}>Project</Text>
              {projectSkills.map(({ name }) => (
                <Text key={`project:${name}`}>- {name}</Text>
              ))}
            </Box>
          )}

          {userSkills.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.colors.status}>User</Text>
              {userSkills.map(({ name }) => (
                <Text key={`user:${name}`}>- {name}</Text>
              ))}
            </Box>
          )}
        </>
      )}

      <Box marginTop={1}>
        <ExitHint />
      </Box>
    </Box>
  );
}
