import { useMemo } from 'react';

import { SelectPrompt } from '@/components/SelectPrompt';
import { COMMAND } from '@/constants';

interface Props {
  input: string;
  onSubmit: (value: string) => void;
}

function getMatchingCommands(input: string) {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput.startsWith('/')) {
    return [];
  }

  return COMMAND.LIST.filter(({ name }) =>
    name.toLowerCase().startsWith(normalizedInput),
  ).map(({ name, description }) => ({
    label: `${name} - ${description}`,
    value: name,
  }));
}

export function CommandMenu({ input, onSubmit }: Props) {
  const commandOptions = useMemo(() => getMatchingCommands(input), [input]);

  if (!commandOptions.length) {
    return null;
  }

  return (
    <SelectPrompt
      highlightText={input}
      onChange={onSubmit}
      options={commandOptions}
    />
  );
}
