import { Spinner } from '@inkjs/ui';
import { Text, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import type { Config } from '../types';
import { ollama, time } from '../utils';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  currentModel: string;
  onSelect: (update: Pick<Config, 'model'>) => void;
  onClose: () => void;
}

export function ModelPicker({ currentModel, onSelect, onClose }: Props) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (model: string) => {
      onSelect({ model });
    },
    [onSelect],
  );

  // close select prompt if current model is chosen
  useInput(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (_input, key) => {
      if (!error && options.length && key.return) {
        await time.tick();
        onClose();
      }
    },
  );

  useEffect(() => {
    async function load() {
      try {
        const models = await ollama.listModels();
        if (models.includes(currentModel)) {
          models.splice(models.indexOf(currentModel), 1);
          models.unshift(currentModel);
        }

        const options = models.map((model) => ({ label: model, value: model }));
        setOptions(options);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : String(error));
      }
    }

    void load();
  }, [currentModel]);

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
      onChange={handleChange}
      onCancel={onClose}
    >
      <SelectPromptHint message="Select a model" />
    </SelectPrompt>
  );
}
