import { Box, Text, useStdout } from 'ink';
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

const SKILL_OPTION_CHROME =
  UI.SCREEN_MARGIN_X * 2 + // marginX on both sides
  1 + // focus pointer
  1 + // gap between pointer and label
  1 + // gap between label and tick
  1; // selected tick

export function Skills({ disabledSkills, onClose, onSave }: Props) {
  const loadedSkills = useMemo(() => skills.loadSkills(), []);
  const { stdout } = useStdout();
  const maxLabelWidth = Math.max(1, stdout.columns - SKILL_OPTION_CHROME);

  const options = useMemo(() => {
    return loadedSkills.map((skill) => {
      const sourceLabel = skill.source === skills.SkillSource.User ? '*' : '';
      const rawLabel = skill.description
        ? `${skill.name}${sourceLabel} - ${skill.description}`
        : `${skill.name}${sourceLabel}`;
      const label =
        rawLabel.length > maxLabelWidth
          ? `${rawLabel.slice(0, maxLabelWidth - 1).trimEnd()}${UI.ELLIPSIS}`
          : rawLabel;
      return { label, value: skill.path };
    });
  }, [loadedSkills, maxLabelWidth]);

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
      const newDisabledSkills = Array.from(
        new Set([
          ...disabledSkills.filter((path) => !visiblePaths.has(path)),
          ...loadedSkills
            .filter((skill) => !selectedSet.has(skill.path))
            .map((skill) => skill.path),
        ]),
      );

      onSave({ disabledSkills: newDisabledSkills });
    },
    [loadedSkills, disabledSkills, onSave],
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline>
          Enable/Disable Skills
        </Text>
      </Box>

      {!loadedSkills.length ? (
        <>
          <Text dimColor>No skills loaded.</Text>
          <Box marginTop={1}>
            <ExitHint />
          </Box>
        </>
      ) : (
        <>
          <Box flexDirection="column" marginBottom={1}>
            <MultiSelectPromptHint escapeLabel="cancel" />
            <Text dimColor>* = user skill</Text>
          </Box>

          <MultiSelectPrompt
            options={options}
            defaultValue={defaultValue}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        </>
      )}
    </Box>
  );
}
