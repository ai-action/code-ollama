import { Select, type SelectProps } from '@inkjs/ui';
import { Box, type BoxProps, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { time } from '@/utils';

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
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void time.tick().then(() => {
      // v8 ignore next
      if (isMounted) {
        setIsInteractive(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel?.();
    }
  });

  return (
    <Box borderStyle={borderStyle} flexDirection="column">
      {children}

      <Select
        {...selectProps}
        isDisabled={selectProps.isDisabled ?? !isInteractive}
      />
    </Box>
  );
}
