import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { COMMANDS, UI } from '../constants';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function getSuggestions(input: string): string[] {
  if (!input.startsWith('/')) {
    return [];
  }

  return COMMANDS.filter((command) => command.name.startsWith(input)).map(
    (command) => command.name,
  );
}

export function ChatInput({ isDisabled = false, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const suggestions = useMemo(() => getSuggestions(value), [value]);

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      onSubmit(trimmed);
      setValue('');
      setResetKey((key) => key + 1);
    },
    [onSubmit],
  );

  return (
    <Box>
      <Text>{UI.PROMPT_PREFIX}</Text>
      <TextInput
        key={resetKey}
        isDisabled={isDisabled}
        defaultValue=""
        suggestions={suggestions}
        onChange={setValue}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
