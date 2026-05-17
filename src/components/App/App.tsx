import { Box } from 'ink';
import { useCallback, useState } from 'react';

import { Chat } from '@/components/Chat';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ModelManager } from '@/components/ModelManager';
import { SearchSettings } from '@/components/SearchSettings';
import { SessionManager } from '@/components/SessionManager';
import { ThemeSettings } from '@/components/ThemeSettings';
import { MODE, THEME } from '@/constants';
import type { Config, Mode } from '@/types';
import { config, session } from '@/utils';

import { SCREEN } from './constants';
import { useScreenRouter, useSessionManager, useThemeSettings } from './hooks';

interface Props {
  sessionId?: string;
}

export function App({ sessionId }: Props) {
  const [appConfig, setConfig] = useState(() => config.loadConfig());
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);

  const { currentScreen, setScreen, handleClose, handleCommand } =
    useScreenRouter();

  const {
    activeSession,
    setSession,
    handleCreateSession,
    handleOpenSession,
    handleDeleteSession,
    handleMessagesChange,
  } = useSessionManager({
    sessionId,
    model: appConfig.model,
    commandColor: THEME.getTheme(appConfig.theme).colors.command,
  });

  const handleUpdateConfig = useCallback(
    (update: Partial<Config>) => {
      setConfig((current) => ({
        ...current,
        ...update,
      }));
      config.saveConfig(update);

      const newModel = update.model;
      if (newModel) {
        setSession((current) => ({
          ...current,
          metadata: session.updateSessionModel(current.metadata.id, newModel),
        }));
      }

      setScreen(SCREEN.CHAT);
    },
    [setScreen, setSession],
  );

  const {
    activeTheme,
    handleThemeClose,
    handleThemePreview,
    handleThemeSave,
    setPreviewThemeId,
  } = useThemeSettings({
    currentTheme: appConfig.theme,
    onUpdateConfig: handleUpdateConfig,
    setScreen,
  });

  const handleHeaderLoad = useCallback(() => {
    setIsHeaderLoaded(true);
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

  const handleChatCommand = useCallback(
    (command: string) => {
      handleCommand(command, {
        model: appConfig.model,
        theme: appConfig.theme,
        onCreateSession: handleCreateSession,
        onSetPreviewThemeId: setPreviewThemeId,
      });
    },
    [
      appConfig.model,
      appConfig.theme,
      handleCommand,
      handleCreateSession,
      setPreviewThemeId,
    ],
  );

  const handleDeleteSessionAndStay = useCallback(
    (sid: string) => {
      handleDeleteSession(sid);
      setScreen(SCREEN.SESSION_MANAGER);
    },
    [handleDeleteSession, setScreen],
  );

  const handleOpenSessionAndNavigate = useCallback(
    (sid: string) => {
      handleOpenSession(sid);
      setScreen(SCREEN.CHAT);
    },
    [handleOpenSession, setScreen],
  );

  const handleCreateSessionAndNavigate = useCallback(() => {
    handleCreateSession();
    setScreen(SCREEN.CHAT);
  }, [handleCreateSession, setScreen]);

  let screenContent: React.ReactNode;

  switch (currentScreen) {
    case SCREEN.MODEL_MANAGER:
      screenContent = (
        <ModelManager
          currentModel={appConfig.model}
          onSelect={handleUpdateConfig}
          onClose={handleClose}
          theme={activeTheme}
        />
      );
      break;

    case SCREEN.SEARCH_SETTINGS:
      screenContent = (
        <SearchSettings
          currentUrl={appConfig.searxngBaseUrl}
          onSave={handleUpdateConfig}
          onClose={handleClose}
          theme={activeTheme}
        />
      );
      break;

    case SCREEN.SESSION_MANAGER:
      screenContent = (
        <SessionManager
          currentSessionId={activeSession.metadata.id}
          onClose={handleClose}
          onDelete={handleDeleteSessionAndStay}
          onNew={handleCreateSessionAndNavigate}
          onOpen={handleOpenSessionAndNavigate}
          theme={activeTheme}
        />
      );
      break;

    case SCREEN.THEME_SETTINGS:
      screenContent = (
        <ThemeSettings
          currentTheme={appConfig.theme}
          onClose={handleThemeClose}
          onPreview={handleThemePreview}
          onSave={handleThemeSave}
        />
      );
      break;

    case SCREEN.CHAT:
      screenContent = (
        <Chat
          initialMessages={activeSession.messages}
          model={appConfig.model}
          onCommand={handleChatCommand}
          onMessagesChange={handleMessagesChange}
          mode={mode}
          onModeChange={setMode}
          sessionId={activeSession.metadata.id}
          theme={activeTheme}
        />
      );
      break;
  }

  return (
    <Box flexDirection="column">
      <Header
        model={appConfig.model}
        onLoad={handleHeaderLoad}
        theme={activeTheme}
      />

      {isHeaderLoaded && screenContent}

      <Footer
        mode={mode}
        model={appConfig.model}
        onToggleMode={handleToggleMode}
        theme={activeTheme}
      />
    </Box>
  );
}
