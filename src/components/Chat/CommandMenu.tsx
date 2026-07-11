import { useMemo } from 'react';

import { Suggestions } from '@/components/Suggestions';
import { COMMAND } from '@/constants';

interface Props {
  input: string;
  onComplete?: (value: string) => void;
  onSubmit: (value: string) => void;
}

export interface CommandOptionValue {
  shouldSubmit: boolean;
  text: string;
}

interface CommandOption {
  label: string;
  value: CommandOptionValue;
}

export const MEMORY_COMMANDS: CommandOption[] = [
  {
    label: '/memory show - display loaded memory',
    value: { shouldSubmit: true, text: '/memory show' },
  },
  {
    label: '/memory path - show memory file paths',
    value: { shouldSubmit: true, text: '/memory path' },
  },
  {
    label: '/memory add <text> - append project memory',
    value: { shouldSubmit: false, text: '/memory add ' },
  },
  {
    label: '/memory add --global <text> - append global memory',
    value: { shouldSubmit: false, text: '/memory add --global ' },
  },
];

export function getMatchingCommands(input: string) {
  const normalizedInput = input.toLowerCase();
  if (!normalizedInput.startsWith('/')) {
    return [];
  }

  if (normalizedInput.startsWith('/memory ')) {
    return MEMORY_COMMANDS.filter(({ value }) =>
      value.text.toLowerCase().startsWith(normalizedInput),
    );
  }

  return COMMAND.LIST.filter(({ name }) =>
    name.toLowerCase().startsWith(normalizedInput.trim()),
  ).map<CommandOption>(({ name, description }) => {
    const shouldCompleteMemory =
      name === '/memory' && normalizedInput.trim() !== '/memory';

    return {
      label: `${name} - ${description}`,
      value: shouldCompleteMemory
        ? { shouldSubmit: false, text: '/memory ' }
        : { shouldSubmit: true, text: name },
    };
  });
}

export function isSubmittableCommand(value: string): boolean {
  // v8 ignore next
  if (value.includes('\n')) {
    return false;
  }

  const trimmedValue = value.trim();
  const runnableMemoryCommands = MEMORY_COMMANDS.filter(
    ({ value }) => value.shouldSubmit,
  ).map(({ value }) => value.text);

  if (trimmedValue === '/memory') {
    return true;
  }

  if (
    trimmedValue === '/memory add' ||
    trimmedValue === '/memory add --global'
  ) {
    return false;
  }

  if (trimmedValue.startsWith('/memory add --global ')) {
    return trimmedValue.slice('/memory add --global '.length).trim().length > 0;
  }

  if (trimmedValue.startsWith('/memory add ')) {
    return trimmedValue.slice('/memory add '.length).trim().length > 0;
  }

  if (
    runnableMemoryCommands.some((command) => command.startsWith(trimmedValue))
  ) {
    return true;
  }

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
        if (option.value.shouldSubmit) {
          onSubmit(option.value.text);
          return;
        }

        onComplete?.(option.value.text);
      }}
      options={commandOptions}
    />
  );
}
