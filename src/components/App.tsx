import { Box, useApp } from 'ink';
import { useCallback, useState } from 'react';

import { MODE } from '../constants';
import { agents, config, screen } from '../utils';
import { Chat } from './Chat';
import { Footer } from './Footer';
import { Header } from './Header';
import { ModelPicker } from './ModelPicker';

export function App() {
  const { exit } = useApp();
  const [model, setModel] = useState(() => config.loadConfig().model);
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<MODE.Name>(MODE.NAME.SAFE);
  const [sessionId, setSessionId] = useState(0);

  const handleCommand = useCallback(
    (command: string) => {
      switch (command) {
        case '/model':
          setPicking(true);
          break;

        case '/clear':
          agents.resetSystemMessage();
          screen.clear();
          setPicking(false);
          setSessionId((sessionId) => sessionId + 1);
          break;

        case '/exit':
          exit();
          break;
      }
    },
    [exit],
  );

  const handleSelect = useCallback((selected: string) => {
    setModel(selected);
    config.saveConfig({ model: selected });
    setPicking(false);
  }, []);

  const handleClose = useCallback(() => {
    setPicking(false);
  }, []);

  const handleToggleMode = useCallback(() => {
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
  }, []);

  let body: React.ReactNode;

  switch (true) {
    case picking:
      body = (
        <ModelPicker
          currentModel={model}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      );
      break;

    default:
      body = (
        <Chat
          model={model}
          onCommand={handleCommand}
          mode={mode}
          onModeChange={setMode}
          sessionId={sessionId}
        />
      );
      break;
  }

  return (
    <Box flexDirection="column">
      <Header model={model} />
      {body}
      <Footer mode={mode} onToggleMode={handleToggleMode} />
    </Box>
  );
}
