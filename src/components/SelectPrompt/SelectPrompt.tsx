import { Select, type SelectProps } from '@inkjs/ui';
import { Box, type BoxProps, useInput } from 'ink';

interface SelectPromptProps extends SelectProps {
  borderStyle?: BoxProps['borderStyle'];
  children?: React.ReactNode;
  onCancel?: () => void;
}

export function SelectPrompt({
  borderStyle,
  children,
  onCancel,
  ...selectProps
}: SelectPromptProps) {
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel?.();
    }
  });

  return (
    <Box borderStyle={borderStyle} flexDirection="column">
      {children}

      <Select {...selectProps} />
    </Box>
  );
}
