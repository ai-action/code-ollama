import { useMemo } from 'react';

import type { ModelCatalogEntry } from '@/constants/models';

import { type SuggestionOption, Suggestions } from './Suggestions';

interface Props {
  catalog: ModelCatalogEntry[];
  input: string;
  isDisabled?: boolean;
  onHighlight?: (value: string | null) => void;
  onSelect: (value: string) => void;
}

function rankCatalogMatch(
  entry: ModelCatalogEntry,
  normalizedInput: string,
): number {
  const normalizedValue = entry.value.toLowerCase();
  const normalizedLabel = entry.label.toLowerCase();

  // v8 ignore start
  switch (true) {
    case normalizedValue.startsWith(normalizedInput):
      return 0;

    case normalizedLabel.startsWith(normalizedInput):
      return 1;

    case normalizedValue.includes(normalizedInput):
      return 2;

    case normalizedLabel.includes(normalizedInput):
      return 3;

    default:
      return Number.MAX_SAFE_INTEGER;
  }
  // v8 ignore stop
}

export function ModelSuggestions({
  catalog,
  input,
  isDisabled = false,
  onHighlight,
  onSelect,
}: Props) {
  const normalizedInput = input.trim().toLowerCase();

  const options = useMemo<SuggestionOption[]>(() => {
    if (!normalizedInput) {
      return [];
    }

    return catalog
      .filter(
        (entry) =>
          entry.value.toLowerCase().includes(normalizedInput) ||
          entry.label.toLowerCase().includes(normalizedInput),
      )
      .sort(
        (left, right) =>
          rankCatalogMatch(left, normalizedInput) -
            rankCatalogMatch(right, normalizedInput) ||
          left.label.localeCompare(right.label),
      )
      .map((entry) => ({ label: entry.value, value: entry.value }));
  }, [catalog, normalizedInput]);

  return (
    <Suggestions
      isDisabled={isDisabled}
      options={options}
      resetKey={input}
      /* v8 ignore next */
      onHighlight={(option) => onHighlight?.(option?.value ?? null)}
      onSelect={(option) => {
        onSelect(option.value);
      }}
    />
  );
}
