import { Box, useApp } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MODE, THEME } from '../constants';
import type { Config, Mode, ThemeId } from '../types';
import { agents, config, ollama, screen, session, terminal } from '../utils';
import { Chat } from './Chat';
import { Footer } from './Footer';
import { Header } from './Header';
import { TURN_ABORTED_MESSAGE } from './Messages/constants';
import { ModelPicker } from './ModelPicker';
import { SearchSettings } from './SearchSettings';
import { SessionManager } from './SessionManager';
import { ThemeSettings } from './ThemeSettings';

enum SCREEN {
  CHAT = 'chat',
  MODEL_PICKER = 'model-picker',
  SEARCH_SETTINGS = 'search-settings',
  SESSION_MANAGER = 'session-manager',
  THEME_SETTINGS = 'theme-settings',
}

interface Props {
  sessionId?: string;
}

function createSession(
  sessionId: string | undefined,
  model: string,
): session.SessionRecord {
  return sessionId
    ? session.loadSession(sessionId)
    : session.createSession(model);
}

export function App({ sessionId }: Props) {
  const { exit } = useApp();
  const [appConfig, setConfig] = useState(() => config.loadConfig());
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);
  const [currentScreen, setScreen] = useState<SCREEN>(SCREEN.CHAT);
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [activeSession, setSession] = useState(() =>
    createSession(sessionId, config.loadConfig().model),
  );
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);
  const sessionRef = useRef(activeSession);
  const activeThemeId = previewThemeId ?? appConfig.theme;
  const activeTheme = THEME.getTheme(activeThemeId);
  const commandColorRef = useRef(activeTheme.colors.command);

  useEffect(() => {
    sessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    commandColorRef.current = activeTheme.colors.command;
  }, [activeTheme.colors.command]);

  useEffect(() => {
    return () => {
      const currentSession = sessionRef.current;
      const deleted = session.deleteSessionIfEmpty(currentSession.metadata.id);

      if (!deleted && currentSession.messages.length > 0) {
        const resumeCommand = `code-ollama resume ${currentSession.metadata.id}`;
        terminal.write(
          `Resume session: ${terminal.color(resumeCommand, commandColorRef.current)}\n`,
        );
      }
    };
  }, []);

  const setActiveSession = useCallback((nextSession: session.SessionRecord) => {
    setSession((current) => {
      session.deleteSessionIfEmpty(current.metadata.id);
      return nextSession;
    });
  }, []);

  const handleHeaderLoad = useCallback(() => {
    setIsHeaderLoaded(true);
  }, []);

  const handleCreateSession = useCallback(() => {
    const nextSession = session.createSession(appConfig.model);
    setActiveSession(nextSession);
    setScreen(SCREEN.CHAT);
    screen.clear(nextSession.metadata.id);
    return nextSession;
  }, [appConfig.model, setActiveSession]);

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      if (sessionRef.current.metadata.id === sessionId) {
        setScreen(SCREEN.CHAT);
        return;
      }

      setActiveSession(session.loadSession(sessionId));
      setScreen(SCREEN.CHAT);
      screen.clear(sessionId);
    },
    [setActiveSession],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      session.deleteSession(sessionId);

      setSession((current) => {
        if (current.metadata.id !== sessionId) {
          return current;
        }

        return session.createSession(appConfig.model);
      });
      setScreen(SCREEN.SESSION_MANAGER);
    },
    [appConfig.model],
  );

  const handleMessagesChange = useCallback(
    (messages: ollama.Message[]) => {
      setSession((current) => {
        const persistedMessages = messages.filter(
          ({ content }) => content !== TURN_ABORTED_MESSAGE,
        );

        if (persistedMessages.length <= current.messages.length) {
          return current;
        }

        let metadata = current.metadata;
        for (const message of persistedMessages.slice(
          current.messages.length,
        )) {
          metadata = session.appendMessage(
            metadata.id,
            message,
            appConfig.model,
          );
        }

        return {
          metadata,
          messages: persistedMessages,
        };
      });
    },
    [appConfig.model],
  );

  const handleCommand = useCallback(
    (command: string) => {
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
          setPreviewThemeId(appConfig.theme);
          setScreen(SCREEN.THEME_SETTINGS);
          break;

        case '/clear': {
          agents.resetSystemMessage();
          setScreen(SCREEN.CHAT);
          const nextSession = session.createSession(appConfig.model);
          setActiveSession(nextSession);
          screen.clear(nextSession.metadata.id);
          break;
        }

        case '/exit':
          exit();
          break;
      }
    },
    [appConfig.model, appConfig.theme, exit, setActiveSession],
  );

  const handleUpdateConfig = useCallback((update: Partial<Config>) => {
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
  }, []);

  const handleClose = useCallback(() => {
    setScreen(SCREEN.CHAT);
  }, []);

  const handleThemePreview = useCallback((themeId: ThemeId) => {
    setPreviewThemeId(themeId);
  }, []);

  const handleThemeClose = useCallback(() => {
    setPreviewThemeId(null);
    setScreen(SCREEN.CHAT);
  }, []);

  const handleThemeSave = useCallback(
    (themeId: ThemeId) => {
      setPreviewThemeId(null);
      handleUpdateConfig({ theme: themeId });
    },
    [handleUpdateConfig],
  );

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
          onDelete={handleDeleteSession}
          onNew={handleCreateSession}
          onOpen={handleOpenSession}
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
          onCommand={handleCommand}
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
