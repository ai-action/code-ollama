import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import { THEME, UI } from '@/constants';
import type { ThemeDefinition, ThemeId } from '@/types';

import { CodeBlock } from '../CodeBlock';
import { SelectPromptHint } from '../SelectPrompt';

interface Props {
  currentTheme: ThemeId;
  onClose: () => void;
  onPreview: (themeId: ThemeId) => void;
  onSave: (themeId: ThemeId) => void;
}

export function ThemeSettings({
  currentTheme,
  onClose,
  onPreview,
  onSave,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const initialIndex = THEME.LIST.findIndex(({ id }) => id === currentTheme);
    return initialIndex >= 0 ? initialIndex : 0;
  });

  const selectedTheme = useMemo<ThemeDefinition>(
    // v8 ignore next
    () => THEME.LIST[selectedIndex] ?? THEME.getTheme(),
    [selectedIndex],
  );

  useEffect(() => {
    onPreview(selectedTheme.id);
  }, [onPreview, selectedTheme.id]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((current) =>
        current === 0 ? THEME.LIST.length - 1 : current - 1,
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((current) =>
        current === THEME.LIST.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (key.return) {
      onSave(selectedTheme.id);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        Theme:{' '}
        <Text color={selectedTheme.colors.accent}>{selectedTheme.label}</Text>
      </Text>
      <Text color={selectedTheme.colors.secondary}>
        {selectedTheme.description}
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {THEME.LIST.map((theme, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Text
              key={theme.id}
              color={isSelected ? selectedTheme.colors.accent : undefined}
            >
              {isSelected ? '›' : ' '} {theme.label}
            </Text>
          );
        })}
      </Box>

      <Box
        borderColor={selectedTheme.colors.border}
        borderStyle="bold"
        flexDirection="column"
        marginTop={1}
        paddingX={1}
      >
        <Text color={selectedTheme.colors.status}>
          {UI.HEADER_PREFIX} Preview
        </Text>

        <Text color={selectedTheme.colors.secondary}>
          Markdown and code styling follow the selected theme.
        </Text>

        <Text>
          Status accent:{' '}
          <Text color={selectedTheme.colors.status}>search enabled</Text>
        </Text>

        <CodeBlock
          code="const theme = 'preview';"
          language="ts"
          role="assistant"
          theme={selectedTheme}
        />
      </Box>

      <Box marginTop={1}>
        <SelectPromptHint
          message="Preview theme"
          escapeLabel="cancel and restore"
        />
      </Box>
    </Box>
  );
}
