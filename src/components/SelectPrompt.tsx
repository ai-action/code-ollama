import type { Option, SelectProps } from '@inkjs/ui';
import { Select } from '@inkjs/ui';
import { Box, useInput } from 'ink';
import type { ReactNode } from 'react';

export interface SelectPromptProps {
  children?: ReactNode;
  options: Option[];
  onChange: NonNullable<SelectProps['onChange']>;
  onEscape?: () => void;
  defaultValue?: SelectProps['defaultValue'];
}

export function SelectPrompt({
  children,
  options,
  onChange,
  onEscape,
  defaultValue,
}: SelectPromptProps) {
  useInput((_, key) => {
    if (key.escape) {
      onEscape?.();
    }
  });

  return (
    <Box flexDirection="column">
      {children}
      <Select
        options={options}
        defaultValue={defaultValue}
        onChange={onChange}
      />
    </Box>
  );
}
