import { Box } from 'ink';
import { useCallback, useState } from 'react';

import { MODE } from '../constants';
import { config } from '../utils';
import { Chat } from './Chat';
import { Footer } from './Footer';
import { Header } from './Header';
import { ModelPicker } from './ModelPicker';

export function App() {
  const [model, setModel] = useState(() => config.loadConfig().model);
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<MODE.Name>(MODE.NAME.SAFE);

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
      <Header model={model} />

      {picking ? (
        <ModelPicker
          currentModel={model}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      ) : (
        <Chat model={model} onCommand={handleCommand} mode={mode} />
      )}

      <Footer
        mode={mode}
        onToggleMode={() => {
          setMode((mode) => {
            // Cycle: safe -> auto -> plan -> safe
            switch (mode) {
              case MODE.NAME.SAFE:
                return MODE.NAME.AUTO;
              case MODE.NAME.AUTO:
                return MODE.NAME.PLAN;
              case MODE.NAME.PLAN:
              default:
                return MODE.NAME.SAFE;
            }
          });
        }}
      />
    </Box>
  );
}
