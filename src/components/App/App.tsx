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
import { MODE, SCREEN, THEME } from '@/constants';
import type { Config, Mode } from '@/types';
import { config, ollama, session } from '@/utils';

import { useScreenRouter, useSessionManager, useThemeSettings } from './hooks';
import { ReadinessCheck, ReadinessState } from './ReadinessCheck';

interface Props {
  sessionId?: string;
}

export function App({ sessionId }: Props) {
  const [appConfig, setConfig] = useState(() => config.loadConfig());
  const [mode, setMode] = useState<Mode>(MODE.SAFE);
  const [isLoaded, setIsLoaded] = useState(false);
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

      if (currentScreen !== SCREEN.CHAT) {
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

  let screenContent: React.ReactNode;

  switch (currentScreen) {
    case SCREEN.MODEL_MANAGER:
      screenContent = (
        <ModelManager
          currentModel={appConfig.model ?? ''}
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
          onDelete={(sessionId) => {
            handleDeleteSession(sessionId);
            setScreen(SCREEN.SESSION_MANAGER);
          }}
          onNew={() => {
            handleCreateSession();
            setScreen(SCREEN.CHAT);
          }}
          onOpen={(sessionId) => {
            handleOpenSession(sessionId);
            setScreen(SCREEN.CHAT);
          }}
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
      <Header model={appConfig.model ?? ''} theme={activeTheme} />

      <UpdateBanner
        onLoad={() => {
          setIsLoaded(true);
        }}
        theme={activeTheme}
      />

      {isLoaded && screenContent}

      <Footer
        mode={mode}
        model={appConfig.model ?? ''}
        // cycle: safe -> auto -> plan
        onToggleMode={() => {
          setMode((mode) => {
            switch (mode) {
              case MODE.SAFE:
                return MODE.AUTO;
              case MODE.AUTO:
                return MODE.PLAN;
              case MODE.PLAN:
                return MODE.SAFE;
            }
          });
        }}
        theme={activeTheme}
      />
    </Box>
  );
}
