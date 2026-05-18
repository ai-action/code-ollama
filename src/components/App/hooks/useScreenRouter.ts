import { useApp } from 'ink';
import { useCallback, useState } from 'react';

import type { ThemeId } from '@/types';
import { agents, screen, session } from '@/utils';

import { Screen } from '../constants';

export interface CommandCallbacks {
  model: string;
  theme: ThemeId;
  onCreateSession: (model: string) => session.SessionRecord;
  onSetPreviewThemeId: (themeId: ThemeId) => void;
}

export function useScreenRouter() {
  const { exit } = useApp();
  const [currentScreen, setScreen] = useState<Screen>(Screen.Chat);

  const handleClose = useCallback(() => {
    setScreen(Screen.Chat);
  }, []);

  const handleCommand = useCallback(
    (command: string, callbacks: CommandCallbacks) => {
      const { onCreateSession, onSetPreviewThemeId, model, theme } = callbacks;
      switch (command) {
        case '/session':
          setScreen(Screen.SessionManager);
          break;

        case '/model':
          setScreen(Screen.ModelManager);
          break;

        case '/search':
          setScreen(Screen.SearchSettings);
          break;

        case '/theme':
          onSetPreviewThemeId(theme);
          setScreen(Screen.ThemeSettings);
          break;

        case '/clear': {
          agents.resetSystemMessage();
          const nextSession = onCreateSession(model);
          setScreen(Screen.Chat);
          screen.clear(nextSession.metadata.id);
          break;
        }

        case '/exit':
          exit();
          break;
      }
    },
    [exit],
  );

  return {
    currentScreen,
    setScreen,
    handleClose,
    handleCommand,
  };
}
