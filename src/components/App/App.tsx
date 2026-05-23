import { Box } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import { Chat } from '@/components/Chat';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ModelManager } from '@/components/ModelManager';
import { SearchSettings } from '@/components/SearchSettings';
import { SessionManager } from '@/components/SessionManager';
import { ThemeSettings } from '@/components/ThemeSettings';
import { UpdateBanner } from '@/components/UpdateBanner';
import { MODE, THEME } from '@/constants';
import type { Config, Mode } from '@/types';
import { config, ollama, session } from '@/utils';

import { Screen } from './constants';
import { useScreenRouter, useSessionManager, useThemeSettings } from './hooks';
import { ReadinessCheck, ReadinessState } from './ReadinessCheck';

interface Props {
  sessionId?: string;
}

export function App({ sessionId }: Props) {
  const [appConfig, setConfig] = useState(() => config.loadConfig());
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [isHeaderLoaded, setIsHeaderLoaded] = useState(false);
  const [setupState, setSetupState] = useState<ReadinessState>(() =>
    appConfig.model ? ReadinessState.Ready : ReadinessState.MissingModelConfig,
  );
  const [setupErrorMessage, setSetupErrorMessage] = useState<string | null>(
    null,
  );

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
    model: appConfig.model ?? '',
    commandColor: THEME.getTheme(appConfig.theme).colors.command,
  });

  useEffect(() => {
    let isMounted = true;

    async function refreshSetupState() {
      if (!appConfig.model) {
        // v8 ignore next
        if (isMounted) {
          setSetupErrorMessage(null);
          setSetupState(ReadinessState.MissingModelConfig);
        }
        return;
      }

      if (currentScreen !== Screen.Chat) {
        return;
      }

      // v8 ignore next
      if (isMounted) {
        setSetupErrorMessage(null);
        setSetupState(ReadinessState.Checking);
      }

      try {
        const isHealthy = await ollama.checkHealth();

        if (!isMounted) {
          return;
        }

        if (!isHealthy) {
          setSetupState(ReadinessState.ServerUnavailable);
          return;
        }

        const installedModels = await ollama.listModels();

        setSetupState(
          installedModels.length > 0
            ? ReadinessState.Ready
            : ReadinessState.NoInstalledModels,
        );
      } catch (error) {
        // v8 ignore start
        if (!isMounted) {
          return;
        }

        setSetupErrorMessage(
          error instanceof Error ? error.message : String(error),
        );

        setSetupState(ReadinessState.ModelLoadError);
        // v8 ignore stop
      }
    }

    void refreshSetupState();

    return () => {
      isMounted = false;
    };
  }, [appConfig.model, currentScreen]);

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

      setScreen(Screen.Chat);
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
        model: appConfig.model ?? '',
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
      setScreen(Screen.SessionManager);
    },
    [handleDeleteSession, setScreen],
  );

  const handleOpenSessionAndNavigate = useCallback(
    (sid: string) => {
      handleOpenSession(sid);
      setScreen(Screen.Chat);
    },
    [handleOpenSession, setScreen],
  );

  const handleCreateSessionAndNavigate = useCallback(() => {
    handleCreateSession();
    setScreen(Screen.Chat);
  }, [handleCreateSession, setScreen]);

  let screenContent: React.ReactNode;

  switch (currentScreen) {
    case Screen.ModelManager:
      screenContent = (
        <ModelManager
          currentModel={appConfig.model ?? ''}
          onSelect={handleUpdateConfig}
          onClose={handleClose}
          theme={activeTheme}
        />
      );
      break;

    case Screen.SearchSettings:
      screenContent = (
        <SearchSettings
          currentUrl={appConfig.searxngBaseUrl}
          onSave={handleUpdateConfig}
          onClose={handleClose}
          theme={activeTheme}
        />
      );
      break;

    case Screen.SessionManager:
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

    case Screen.ThemeSettings:
      screenContent = (
        <ThemeSettings
          currentTheme={appConfig.theme}
          onClose={handleThemeClose}
          onPreview={handleThemePreview}
          onSave={handleThemeSave}
        />
      );
      break;

    case Screen.Chat:
      screenContent =
        setupState === ReadinessState.Ready ? (
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
        ) : (
          <ReadinessCheck
            errorMessage={setupErrorMessage}
            onCommand={handleChatCommand}
            setupState={setupState}
            theme={activeTheme}
          />
        );
      break;
  }

  return (
    <Box flexDirection="column">
      <Header
        model={appConfig.model ?? ''}
        onLoad={handleHeaderLoad}
        theme={activeTheme}
      />

      <UpdateBanner theme={activeTheme} />

      {isHeaderLoaded && screenContent}

      <Footer
        mode={mode}
        model={appConfig.model ?? ''}
        onToggleMode={handleToggleMode}
        theme={activeTheme}
      />
    </Box>
  );
}
