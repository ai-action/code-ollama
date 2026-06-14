import { useApp } from 'ink';
import { useCallback, useState } from 'react';

import { SCREEN } from '@/constants';
import type { Screen, ThemeId } from '@/types';
import { agents, session } from '@/utils';

export interface CommandCallbacks {
  model: string;
  theme: ThemeId;
  onCreateSession: (model: string) => session.SessionRecord;
  onSetPreviewThemeId: (themeId: ThemeId) => void;
}

interface UseScreenRouterOptions {
  initialScreen?: Screen;
}

export function useScreenRouter({
  initialScreen,
}: UseScreenRouterOptions = {}) {
  const { exit } = useApp();
  const [currentScreen, setScreen] = useState<Screen>(
    initialScreen ?? SCREEN.CHAT,
  );

  const handleClose = useCallback(() => {
    setScreen(SCREEN.CHAT);
  }, []);

  const handleCommand = useCallback(
    (command: string, callbacks: CommandCallbacks) => {
      const { onCreateSession, onSetPreviewThemeId, model, theme } = callbacks;
      switch (command) {
        case '/sessions':
          setScreen(SCREEN.SESSION_MANAGER);
          break;

        case '/models':
          setScreen(SCREEN.MODEL_MANAGER);
          break;

        case '/mcp':
          setScreen(SCREEN.MCP_STATUS);
          break;

        case '/search':
          setScreen(SCREEN.SEARCH_SETTINGS);
          break;

        case '/skills':
          setScreen(SCREEN.SKILLS);
          break;

        case '/theme':
          onSetPreviewThemeId(theme);
          setScreen(SCREEN.THEME_SETTINGS);
          break;

        case '/clear': {
          agents.resetSystemMessage();
          onCreateSession(model);
          setScreen(SCREEN.CHAT);
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
