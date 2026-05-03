import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { Chat } from './Chat';
import { ModelPicker } from './ModelPicker';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4';

export function App() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [picking, setPicking] = useState(false);

  const handleCommand = useCallback((command: string) => {
    if (command === '/model') {
      setPicking(true);
    }
  }, []);

  const handleSelect = useCallback((selected: string) => {
    setModel(selected);
    setPicking(false);
  }, []);

  const handleCancel = useCallback(() => {
    setPicking(false);
  }, []);

  return (
    <Box flexDirection="column">
      <Text>Code Ollama</Text>
      <Text dimColor>model: {model}</Text>

      {picking ? (
        <ModelPicker
          currentModel={model}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      ) : (
        <Chat model={model} onCommand={handleCommand} />
      )}
    </Box>
  );
}
