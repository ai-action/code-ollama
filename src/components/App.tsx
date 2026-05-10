import { Box, useApp } from 'ink';
import { useCallback, useState } from 'react';

import { MODE } from '../constants';
import type { Config, Mode } from '../types';
import { agents, config, screen } from '../utils';
import { Chat } from './Chat';
import { Footer } from './Footer';
import { Header } from './Header';
import { ModelPicker } from './ModelPicker';
import { SearchSettings } from './SearchSettings';

enum SCREEN {
  CHAT = 'chat',
  MODEL_PICKER = 'model-picker',
  SEARCH_SETTINGS = 'search-settings',
}

export function App() {
  const { exit } = useApp();
  const [appConfig, setConfig] = useState(() => config.loadConfig());
  const [currentScreen, setScreen] = useState<SCREEN>(SCREEN.CHAT);
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [sessionId, setSessionId] = useState(0);
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);

  const handleHeaderLoad = useCallback(() => {
    setIsHeaderLoaded(true);
  }, []);

  const handleCommand = useCallback(
    (command: string) => {
      switch (command) {
        case '/model':
          setScreen(SCREEN.MODEL_PICKER);
          break;

        case '/search':
          setScreen(SCREEN.SEARCH_SETTINGS);
          break;

        case '/clear':
          agents.resetSystemMessage();
          screen.clear();
          setScreen(SCREEN.CHAT);
          setSessionId((sessionId) => sessionId + 1);
          break;

        case '/exit':
          exit();
          break;
      }
    },
    [exit],
  );

  const handleUpdateConfig = useCallback((update: Partial<Config>) => {
    setConfig((current) => ({
      ...current,
      ...update,
    }));
    config.saveConfig(update);
    setScreen(SCREEN.CHAT);
  }, []);

  const handleClose = useCallback(() => {
    setScreen(SCREEN.CHAT);
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((mode) => {
      // Cycle: safe -> auto -> plan -> safe
      switch (mode) {
        case MODE.SAFE:
          return MODE.AUTO;

        case MODE.AUTO:
          return MODE.PLAN;

        case MODE.PLAN:
        default:
          return MODE.SAFE;
      }
    });
  }, []);

  let screenContent: React.ReactNode;

  switch (currentScreen) {
    case SCREEN.MODEL_PICKER:
      screenContent = (
        <ModelPicker
          currentModel={appConfig.model}
          onSelect={handleUpdateConfig}
          onClose={handleClose}
        />
      );
      break;

    case SCREEN.SEARCH_SETTINGS:
      screenContent = (
        <SearchSettings
          currentUrl={appConfig.searxngBaseUrl}
          onSave={handleUpdateConfig}
          onClose={handleClose}
        />
      );
      break;

    case SCREEN.CHAT:
      screenContent = (
        <Chat
          model={appConfig.model}
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
      <Header model={appConfig.model} onLoad={handleHeaderLoad} />

      {isHeaderLoaded && screenContent}

      <Footer
        mode={mode}
        model={appConfig.model}
        onToggleMode={handleToggleMode}
      />
    </Box>
  );
}
