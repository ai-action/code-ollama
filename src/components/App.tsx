import { Box, useApp } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MODE } from '../constants';
import type { Config, Mode } from '../types';
import { agents, config, ollama, screen, session } from '../utils';
import { Chat } from './Chat';
import { Footer } from './Footer';
import { Header } from './Header';
import { TURN_ABORTED_MESSAGE } from './Messages/constants';
import { ModelPicker } from './ModelPicker';
import { SearchSettings } from './SearchSettings';
import { SessionManager } from './SessionManager';

enum SCREEN {
  CHAT = 'chat',
  MODEL_PICKER = 'model-picker',
  SEARCH_SETTINGS = 'search-settings',
  SESSION_MANAGER = 'session-manager',
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
  const [currentScreen, setScreen] = useState<SCREEN>(SCREEN.CHAT);
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [activeSession, setSession] = useState(() =>
    createSession(sessionId, config.loadConfig().model),
  );
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);
  const sessionRef = useRef(activeSession);

  useEffect(() => {
    sessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    return () => {
      session.deleteSessionIfEmpty(sessionRef.current.metadata.id);
    };
  }, []);

  const handleHeaderLoad = useCallback(() => {
    setIsHeaderLoaded(true);
  }, []);

  const handleCreateSession = useCallback(() => {
    const nextSession = session.createSession(appConfig.model);
    setSession(nextSession);
    setScreen(SCREEN.CHAT);
    return nextSession;
  }, [appConfig.model]);

  const handleOpenSession = useCallback((sessionId: string) => {
    setSession(session.loadSession(sessionId));
    setScreen(SCREEN.CHAT);
  }, []);

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

        case '/clear': {
          agents.resetSystemMessage();
          setScreen(SCREEN.CHAT);
          const nextSession = session.createSession(appConfig.model);
          setSession(nextSession);
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

    case SCREEN.SESSION_MANAGER:
      screenContent = (
        <SessionManager
          currentSessionId={activeSession.metadata.id}
          onClose={handleClose}
          onDelete={handleDeleteSession}
          onNew={handleCreateSession}
          onOpen={handleOpenSession}
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
