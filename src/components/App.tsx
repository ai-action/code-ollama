import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { config } from '../utils';
import { Chat } from './Chat';
import { ModelPicker } from './ModelPicker';

export function App() {
  const [model, setModel] = useState(() => config.loadConfig().model);
  const [picking, setPicking] = useState(false);

  const handleCommand = useCallback((command: string) => {
    if (command === '/model') {
      setPicking(true);
    }
  }, []);

  const handleSelect = useCallback((selected: string) => {
    setModel(selected);
    config.saveConfig({ model: selected });
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
