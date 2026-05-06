import { Select, Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { ollama } from '../utils';

interface Props {
  currentModel: string;
  onSelect: (model: string) => void;
  onCancel: () => void;
}

export function ModelPicker({ currentModel, onSelect, onCancel }: Props) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await ollama.listModels();
        setOptions(list.map((name) => ({ label: name, value: name })));
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : String(error));
      }
    }

    void load();
  }, []);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  if (error) {
    return <Text color="red">Error loading models: {error}</Text>;
  }

  if (!options.length) {
    return <Spinner label="Loading models..." />;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>
        Select a model (↑↓ + Enter to confirm, Esc to cancel)
      </Text>

      <Select
        options={options}
        defaultValue={currentModel}
        onChange={onSelect}
      />
    </Box>
  );
}
