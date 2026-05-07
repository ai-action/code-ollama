import type { SelectProps } from '@inkjs/ui';
import { Select } from '@inkjs/ui';
import { Box, useInput } from 'ink';
import type { ReactNode } from 'react';

export interface SelectPromptProps extends SelectProps {
  children?: ReactNode;
  onEscape?: () => void;
}

export function SelectPrompt({
  children,
  onEscape,
  ...selectProps
}: SelectPromptProps) {
  useInput((_, key) => {
    if (key.escape) {
      onEscape?.();
    }
  });

  return (
    <Box flexDirection="column">
      {children}

      <Select {...selectProps} />
    </Box>
  );
}
