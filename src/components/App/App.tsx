import { Box } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import { Chat } from '@/components/Chat';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ModelManager } from '@/components/ModelManager';
import { SearchSettings } from '@/components/SearchSettings';
import { SessionManager } from '@/components/SessionManager';
import { Skills } from '@/components/Skills';
import { ThemeSettings } from '@/components/ThemeSettings';
import { UpdateBanner } from '@/components/UpdateBanner';
import { MODE, SCREEN, THEME, UI } from '@/constants';
import { ThemeProvider } from '@/contexts';
import type { Config, Mode, Screen } from '@/types';
import { agents, config, ollama, session } from '@/utils';

import { useScreenRouter, useSessionManager, useThemeSettings } from './hooks';
import { ReadinessCheck, ReadinessState } from './ReadinessCheck';

interface Props {
  sessionId?: string;
  initialScreen?: Screen;
}

export function App({ sessionId, initialScreen }: Props) {
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
    useScreenRouter({ initialScreen });

  const {
    activeSession,
    setSession,
    handleCreateSession,
    handleOpenSession,
    handleDeleteSession,
    handleMessagesChange,
    handleMessagesReplace,
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

  const withScreenMargin = (content: React.ReactNode) => (
    <Box flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
      {content}
    </Box>
  );

  switch (currentScreen) {
    case SCREEN.MODEL_MANAGER:
      screenContent = withScreenMargin(
        <ModelManager
          currentModel={appConfig.model ?? ''}
          onSelect={handleUpdateConfig}
          onClose={handleClose}
        />,
      );
      break;

    case SCREEN.SEARCH_SETTINGS:
      screenContent = withScreenMargin(
        <SearchSettings
          currentUrl={appConfig.searxngBaseUrl}
          onSave={handleUpdateConfig}
          onClose={handleClose}
        />,
      );
      break;

    case SCREEN.SESSION_MANAGER:
      screenContent = withScreenMargin(
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
        />,
      );
      break;

    case SCREEN.SKILLS:
      screenContent = withScreenMargin(
        <Skills
          disabledSkills={appConfig.disabledSkills ?? []}
          onClose={handleClose}
          onSave={(update) => {
            handleUpdateConfig(update);
            agents.resetSystemMessage();
          }}
        />,
      );
      break;

    case SCREEN.THEME_SETTINGS:
      screenContent = withScreenMargin(
        <ThemeSettings
          currentTheme={appConfig.theme}
          onClose={handleThemeClose}
          onPreview={handleThemePreview}
          onSave={handleThemeSave}
        />,
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
            onMessagesReplace={handleMessagesReplace}
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
          />
        );
      break;
  }

  return (
    <ThemeProvider theme={activeTheme}>
      <Box flexDirection="column">
        <Header model={appConfig.model ?? ''} />

        <UpdateBanner
          onLoad={() => {
            setIsLoaded(true);
          }}
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
        />
      </Box>
    </ThemeProvider>
  );
}
