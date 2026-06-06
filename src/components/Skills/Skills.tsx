import { Box, Text, useInput } from 'ink';
import { useMemo } from 'react';

import { ExitHint } from '@/components';
import { UI } from '@/constants';
import { skills } from '@/utils';

import { SkillsList } from './SkillsList';

interface Props {
  onClose: () => void;
}

export function Skills({ onClose }: Props) {
  const loadedSkills = useMemo(() => skills.loadSkills(), []);
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
    <Box flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
      <Text bold underline>
        Skills
      </Text>

      {!loadedSkills.length ? (
        <Text dimColor>No skills loaded.</Text>
      ) : (
        <>
          <SkillsList items={projectSkills} label="Project" />
          <SkillsList items={userSkills} label="User" />
        </>
      )}

      <Box marginTop={1}>
        <ExitHint />
      </Box>
    </Box>
  );
}
