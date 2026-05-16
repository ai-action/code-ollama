import { useApp } from 'ink';
import { useCallback, useState } from 'react';

import type { ThemeId } from '../../../types';
import { agents, screen, session } from '../../../utils';
import { SCREEN } from '../constants';

export interface CommandCallbacks {
  model: string;
  theme: ThemeId;
  onCreateSession: (model: string) => session.SessionRecord;
  onSetPreviewThemeId: (themeId: ThemeId) => void;
}

export function useScreenRouter() {
  const { exit } = useApp();
  const [currentScreen, setScreen] = useState<SCREEN>(SCREEN.CHAT);

  const handleClose = useCallback(() => {
    setScreen(SCREEN.CHAT);
  }, []);

  const handleCommand = useCallback(
    (command: string, callbacks: CommandCallbacks) => {
      const { onCreateSession, onSetPreviewThemeId, model, theme } = callbacks;
      switch (command) {
        case '/session':
          setScreen(SCREEN.SESSION_MANAGER);
          break;

        case '/model':
          setScreen(SCREEN.MODEL_PICKER);
          break;

        case '/search':
          setScreen(SCREEN.SEARCH_SETTINGS);
          break;

        case '/theme':
          onSetPreviewThemeId(theme);
          setScreen(SCREEN.THEME_SETTINGS);
          break;

        case '/clear': {
          agents.resetSystemMessage();
          const nextSession = onCreateSession(model);
          setScreen(SCREEN.CHAT);
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
