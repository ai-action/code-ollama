import { useMemo } from 'react';

import { Suggestions } from '@/components/Suggestions';
import { COMMAND } from '@/constants';

interface Props {
  input: string;
  onComplete?: (value: string) => void;
  onSubmit: (value: string) => void;
}

export interface CommandOptionValue {
  text: string;
}

interface CommandOption {
  label: string;
  value: CommandOptionValue;
}

export function getMatchingCommands(input: string) {
  const normalizedInput = input.toLowerCase();
  if (!normalizedInput.startsWith('/')) {
    return [];
  }

  return COMMAND.LIST.filter(({ name }) =>
    name.toLowerCase().startsWith(normalizedInput.trim()),
  ).map<CommandOption>(({ name, description }) => {
    return {
      label: `${name} - ${description}`,
      value: { text: name },
    };
  });
}

export function isSubmittableCommand(value: string): boolean {
  // v8 ignore next
  if (value.includes('\n')) {
    return false;
  }

  const trimmedValue = value.trim();
  return COMMAND.LIST.some(({ name }) => name === trimmedValue);
}

export function CommandMenu({ input, onComplete, onSubmit }: Props) {
  const commandOptions = useMemo(() => getMatchingCommands(input), [input]);

  if (!commandOptions.length) {
    return null;
  }

  return (
    <Suggestions
      onComplete={(option) => {
        onComplete?.(option.value.text);
      }}
      onSelect={(option) => {
        onSubmit(option.value.text);
      }}
      options={commandOptions}
    />
  );
}
