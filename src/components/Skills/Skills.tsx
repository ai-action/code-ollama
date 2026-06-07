import { Box, Text } from 'ink';
import { useCallback, useMemo } from 'react';

import { ExitHint } from '@/components';
import { UI } from '@/constants';
import type { Config } from '@/types';
import { skills } from '@/utils';

import { MultiSelectPrompt, MultiSelectPromptHint } from '../MultiSelectPrompt';

interface Props {
  disabledSkills: string[];
  onClose: () => void;
  onSave: (update: Pick<Config, 'disabledSkills'>) => void;
}

export function Skills({ disabledSkills, onClose, onSave }: Props) {
  const loadedSkills = useMemo(() => skills.loadSkills(), []);

  const options = useMemo(() => {
    return loadedSkills.map((skill) => ({
      label: `${skill.name} (${skill.source})`,
      value: skill.path,
    }));
  }, [loadedSkills]);

  const defaultValue = useMemo(() => {
    return loadedSkills
      .filter((skill) => !disabledSkills.includes(skill.path))
      .map((skill) => skill.path);
  }, [loadedSkills, disabledSkills]);

  const handleSubmit = useCallback(
    (selectedPaths: string[]) => {
      const visiblePaths = new Set(loadedSkills.map((s) => s.path));
      const selectedSet = new Set(selectedPaths);

      // Compute new disabledSkills:
      // - Remove currently disabled paths that are now enabled (in selectedPaths)
      // - Add currently visible paths that are now disabled (not in selectedPaths)
      // - Preserve disabled paths for skills not currently loaded (offscreen)
      const newDisabledSkills = [
        ...disabledSkills.filter((path) => !visiblePaths.has(path)),
        ...loadedSkills
          .filter((skill) => !selectedSet.has(skill.path))
          .map((skill) => skill.path),
      ];

      onSave({ disabledSkills: newDisabledSkills });
    },
    [loadedSkills, disabledSkills, onSave],
  );

  if (!loadedSkills.length) {
    return (
      <Box flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
        <Text bold underline>
          Skills
        </Text>
        <Text dimColor>No skills loaded.</Text>
        <Box marginTop={1}>
          <ExitHint />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
      <Text bold underline>
        Skills
      </Text>
      <MultiSelectPromptHint escapeLabel="cancel" />

      <MultiSelectPrompt
        options={options}
        defaultValue={defaultValue}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />

      <Box marginTop={1}>
        <ExitHint />
      </Box>
    </Box>
  );
}
