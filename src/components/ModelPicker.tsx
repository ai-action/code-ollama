import { Spinner } from '@inkjs/ui';
import { Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { ollama } from '../utils';
import { SelectPrompt } from './SelectPrompt';

interface Props {
  currentModel: string;
  onSelect: (model: string) => void;
  onClose: () => void;
}

export function ModelPicker({ currentModel, onSelect, onClose }: Props) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  // close select prompt if current model is chosen
  useInput((_, key) => {
    if (options.length && key.return) {
      setTimeout(onClose);
    }
  });

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

  if (error) {
    return <Text color="red">Error loading models: {error}</Text>;
  }

  if (!options.length) {
    return <Spinner label="Loading models..." />;
  }

  return (
    <SelectPrompt
      options={options}
      defaultValue={currentModel}
      onChange={onSelect}
      onEscape={onClose}
    >
      <Text dimColor>
        Select a model (↑↓ + Enter to confirm, Esc to cancel)
      </Text>
    </SelectPrompt>
  );
}
