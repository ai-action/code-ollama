import { MultiSelect, type MultiSelectProps } from '@inkjs/ui';
import { Box, type BoxProps, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { time } from '@/utils';

interface MultiSelectPromptProps extends MultiSelectProps {
  borderStyle?: BoxProps['borderStyle'];
  children?: React.ReactNode;
  onCancel?: () => void;
}

export function MultiSelectPrompt({
  borderStyle,
  children,
  onCancel,
  ...multiSelectProps
}: MultiSelectPromptProps) {
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void time.tick().then(() => {
      // v8 ignore next
      if (isMounted) {
        setIsInteractive(true);
      }
    });

    // v8 ignore next
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

      <MultiSelect
        {...multiSelectProps}
        isDisabled={multiSelectProps.isDisabled ?? !isInteractive}
      />
    </Box>
  );
}
