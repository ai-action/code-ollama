import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { COMMAND, UI } from '../../constants';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

export function Input({ isDisabled = false, onSubmit }: Props) {
  const [resetKey, setResetKey] = useState(0);

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      onSubmit(trimmed);
      setResetKey((key) => key + 1);
    },
    [onSubmit],
  );

  return (
    <Box>
      <Text>{UI.PROMPT_PREFIX}</Text>

      <TextInput
        isDisabled={isDisabled}
        key={resetKey}
        suggestions={COMMAND.NAMES}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
