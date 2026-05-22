import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { TURN_ABORTED_MESSAGE } from '@/components/Messages/constants';
import { time } from '@/utils';

const { mockExit } = vi.hoisted(() => ({
  mockExit: vi.fn(),
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useApp: vi.fn(() => ({
    exit: mockExit,
  })),
}));

const resetSystemMessage = vi.hoisted(() => vi.fn());
const clearScreen = vi.hoisted(() => vi.fn());
const colorTerminal = vi.hoisted(() =>
  vi.fn((text: string, color: string) => `colored(${color}):${text}`),
);
const writeTerminal = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());
const loadSession = vi.hoisted(() => vi.fn());
const listSessions = vi.hoisted(() => vi.fn());
const deleteSession = vi.hoisted(() => vi.fn());
const deleteSessionIfEmpty = vi.hoisted(() => vi.fn());
const appendMessage = vi.hoisted(() => vi.fn());
const updateSessionModel = vi.hoisted(() => vi.fn());
const saveConfig = vi.hoisted(() => vi.fn());
const checkHealth = vi.hoisted(() => vi.fn());
const listModels = vi.hoisted(() => vi.fn());

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  agents: {
    resetSystemMessage,
  },
  config: {
    loadConfig: vi.fn(() => ({
      host: 'http://localhost:11434',
      model: 'gemma4',
      searxngBaseUrl: undefined,
      theme: 'github-dark',
    })),
    saveConfig,
  },
  ollama: {
    checkHealth,
    listModels,
  },
  screen: {
    clear: clearScreen,
  },
  session: {
    appendMessage,
    createSession,
    deleteSession,
    deleteSessionIfEmpty,
    listSessions,
    loadSession,
    updateSessionModel,
  },
  terminal: {
    color: colorTerminal,
    write: writeTerminal,
  },
}));

const capturedCallbacks = vi.hoisted(() => ({
  onCommand: null as ((command: string) => void) | null,
  onModeChange: null as ((mode: string) => void) | null,
  onSelect: null as ((update: { model: string }) => void) | null,
  onSaveSearch: null as ((update: { searxngBaseUrl?: string }) => void) | null,
  onPreviewTheme: null as ((themeId: string) => void) | null,
  onSaveTheme: null as ((themeId: string) => void) | null,
  onClose: null as (() => void) | null,
  onToggleMode: null as (() => void) | null,
  onOpenSession: null as ((sessionId: string) => void) | null,
  onDeleteSession: null as ((sessionId: string) => void) | null,
  onNewSession: null as (() => void) | null,
  onMessagesChange: null as
    | ((messages: { role: string; content: string }[]) => void)
    | null,
}));

vi.mock('@/components/Header', () => ({
  Header: ({ model, onLoad }: { model: string; onLoad: () => void }) => {
    onLoad();
    return <Text>Code Ollama model: {model}</Text>;
  },
}));

vi.mock('@/components/Chat', () => ({
  Chat: ({
    onCommand,
    onMessagesChange,
    onModeChange,
    sessionId,
  }: {
    model: string;
    onCommand: (command: string) => void;
    onMessagesChange?: (messages: { role: string; content: string }[]) => void;
    mode: string;
    onModeChange: (mode: string) => void;
    sessionId: string;
  }) => {
    capturedCallbacks.onCommand = onCommand;
    capturedCallbacks.onMessagesChange = onMessagesChange ?? null;
    capturedCallbacks.onModeChange = onModeChange;
    return <Text>{`> session:${sessionId}`}</Text>;
  },
}));

vi.mock('@/components/ModelManager', () => ({
  ModelManager: ({
    onSelect,
    onClose,
  }: {
    currentModel: string;
    onSelect: (update: { model: string }) => void;
    onClose: () => void;
  }) => {
    capturedCallbacks.onSelect = onSelect;
    capturedCallbacks.onClose = onClose;
    return <Text>ModelManager</Text>;
  },
}));

vi.mock('@/components/SearchSettings', () => ({
  SearchSettings: ({
    onSave,
    onClose,
  }: {
    currentUrl?: string;
    onSave: (update: { searxngBaseUrl?: string }) => void;
    onClose: () => void;
  }) => {
    capturedCallbacks.onSaveSearch = onSave;
    capturedCallbacks.onClose = onClose;
    return <Text>SearchSettings</Text>;
  },
}));

vi.mock('@/components/ThemeSettings', () => ({
  ThemeSettings: ({
    onClose,
    onPreview,
    onSave,
  }: {
    currentTheme: string;
    onClose: () => void;
    onPreview: (themeId: string) => void;
    onSave: (themeId: string) => void;
  }) => {
    capturedCallbacks.onClose = onClose;
    capturedCallbacks.onPreviewTheme = onPreview;
    capturedCallbacks.onSaveTheme = onSave;
    return <Text>ThemeSettings</Text>;
  },
}));

vi.mock('@/components/Footer', () => ({
  Footer: ({
    mode,
    onToggleMode,
  }: {
    mode: string;
    onToggleMode: () => void;
  }) => {
    capturedCallbacks.onToggleMode = onToggleMode;
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
    return <Text>Mode: {modeLabel}</Text>;
  },
}));

vi.mock('@/components/SessionManager', () => ({
  SessionManager: ({
    error,
    onClose,
    onDelete,
    onNew,
    onOpen,
  }: {
    currentSessionId: string;
    error?: string;
    sessions: { id: string }[];
    onClose: () => void;
    onDelete: (sessionId: string) => void;
    onNew: () => void;
    onOpen: (sessionId: string) => void;
  }) => {
    capturedCallbacks.onClose = onClose;
    capturedCallbacks.onDeleteSession = onDelete;
    capturedCallbacks.onNewSession = onNew;
    capturedCallbacks.onOpenSession = onOpen;
    return <Text>{error ? `SessionManager ${error}` : 'SessionManager'}</Text>;
  },
}));

vi.mock('./ReadinessCheck', async () => {
  const actual =
    await vi.importActual<typeof import('./ReadinessCheck')>(
      './ReadinessCheck',
    );

  return {
    ...actual,
    ReadinessCheck: (props: {
      errorMessage?: string | null;
      onCommand: (command: string) => void;
      setupState: string;
    }) => {
      const { errorMessage, onCommand, setupState } = props;
      capturedCallbacks.onCommand = onCommand;
      const message =
        setupState === 'missing-model-config'
          ? 'Select or download a model'
          : setupState === 'no-installed-models'
            ? 'Download a model'
            : setupState === 'server-unavailable'
              ? 'Run ollama serve'
              : errorMessage
                ? `Unable to load models: ${errorMessage}`
                : setupState;
      return <Text>{`Setup Required ${message}`}</Text>;
    },
  };
});

import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    capturedCallbacks.onCommand = null;
    capturedCallbacks.onModeChange = null;
    capturedCallbacks.onSelect = null;
    capturedCallbacks.onSaveSearch = null;
    capturedCallbacks.onPreviewTheme = null;
    capturedCallbacks.onSaveTheme = null;
    capturedCallbacks.onClose = null;
    capturedCallbacks.onToggleMode = null;
    capturedCallbacks.onOpenSession = null;
    capturedCallbacks.onDeleteSession = null;
    capturedCallbacks.onNewSession = null;
    capturedCallbacks.onMessagesChange = null;
    resetSystemMessage.mockClear();
    clearScreen.mockClear();
    colorTerminal.mockClear();
    writeTerminal.mockClear();
    mockExit.mockReset();
    createSession.mockReset();
    loadSession.mockReset();
    listSessions.mockReset();
    deleteSession.mockReset();
    deleteSessionIfEmpty.mockReset();
    appendMessage.mockReset();
    updateSessionModel.mockReset();
    saveConfig.mockReset();
    checkHealth.mockReset();
    listModels.mockReset();
    checkHealth.mockResolvedValue(true);
    listModels.mockResolvedValue(['gemma4']);

    let counter = 0;
    createSession.mockImplementation((model: string) => ({
      metadata: {
        id: `session-${String(counter++)}`,
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        title: 'New session',
        model,
      },
      messages: [],
    }));
    loadSession.mockImplementation((sessionId: string) => ({
      metadata: {
        id: sessionId,
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        title: sessionId,
        model: 'gemma4',
      },
      messages: [],
    }));
    listSessions.mockReturnValue([
      {
        id: 'session-0',
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        title: 'Session 0',
        model: 'gemma4',
      },
    ]);
    appendMessage.mockImplementation((_sessionId, _message, model: string) => ({
      id: 'session-0',
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:01.000Z',
      title: 'Session 0',
      model,
    }));
    updateSessionModel.mockImplementation(
      (sessionId: string, model: string) => ({
        id: sessionId,
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        title: sessionId,
        model,
      }),
    );
  });

  it('renders title', () => {
    // stderr | src/components/App.test.tsx > App > renders title
    // Cannot update a component (`App`) while rendering a different component (`Header`). To locate the bad setState() call inside `Header`, follow the stack trace as described in https://react.dev/link/setstate-in-render
    vi.spyOn(console, 'error').mockImplementation(
      (msg: unknown, ...args: unknown[]) => {
        if (
          typeof msg === 'string' &&
          msg.includes('Cannot update a component')
        ) {
          return;
        }
        process.stderr.write([msg, ...args].join(' ') + '\n');
      },
    );
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Code Ollama');
    vi.restoreAllMocks();
  });

  it('shows ModelManager when /model command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('ModelManager');
  });

  it('returns to chat and updates model when onSelect is called', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();
    capturedCallbacks.onSelect?.({ model: 'llama3' });
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('llama3');
    expect(lastFrame()).not.toContain('ModelManager');
  });

  it('returns to chat when onClose is called', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();
    capturedCallbacks.onClose?.();
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).not.toContain('ModelManager');
    expect(lastFrame()).toContain('>');
  });

  it('shows SearchSettings when /search command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/search');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('SearchSettings');
  });

  it('shows ThemeSettings when /theme command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/theme');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('ThemeSettings');
  });

  it('returns to chat when search settings are saved', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/search');
    rerender(<App />);
    await time.tick();
    capturedCallbacks.onSaveSearch?.({
      searxngBaseUrl: 'https://search.example.com',
    });
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).not.toContain('SearchSettings');
    expect(lastFrame()).toContain('>');
  });

  it('does not open ModelManager for unknown commands', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/unknown');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).not.toContain('ModelManager');
  });

  it('previews and saves a theme', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/theme');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onPreviewTheme?.('dracula');
    capturedCallbacks.onSaveTheme?.('dracula');
    rerender(<App />);
    await time.tick();

    expect(saveConfig).toHaveBeenCalledWith({ theme: 'dracula' });
    expect(lastFrame()).not.toContain('ThemeSettings');
  });

  it('restores chat without saving when theme settings close', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/theme');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onPreviewTheme?.('nord');
    capturedCallbacks.onClose?.();
    rerender(<App />);
    await time.tick();

    expect(saveConfig).not.toHaveBeenCalled();
    expect(lastFrame()).not.toContain('ThemeSettings');
    expect(lastFrame()).toContain('>');
  });

  it('calls exit when /exit command is issued', () => {
    render(<App />);
    capturedCallbacks.onCommand?.('/exit');
    expect(mockExit).toHaveBeenCalledOnce();
  });

  it('deletes an empty active session when the app exits', () => {
    const { unmount } = render(<App />);

    unmount();

    expect(deleteSessionIfEmpty).toHaveBeenCalledWith('session-0');
    expect(writeTerminal).not.toHaveBeenCalled();
  });

  it('prints a resume command when the app exits with session messages', async () => {
    deleteSessionIfEmpty.mockReturnValue(false);
    const { unmount, rerender } = render(<App />);
    await time.tick();

    capturedCallbacks.onMessagesChange?.([
      { role: 'user', content: 'saved message' },
      { role: 'assistant', content: 'saved reply' },
    ]);
    rerender(<App />);
    await time.tick();
    unmount();

    expect(writeTerminal).toHaveBeenCalledWith(
      'Resume session: colored(cyan):code-ollama resume session-0\n',
    );
    expect(colorTerminal).toHaveBeenCalledWith(
      'code-ollama resume session-0',
      'cyan',
    );
  });

  it('resets the chat session when /clear is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    await time.tick();

    expect(lastFrame()).toContain('session:session-0');

    capturedCallbacks.onCommand?.('/clear');
    rerender(<App />);
    await time.tick();

    expect(resetSystemMessage).toHaveBeenCalledOnce();
    expect(clearScreen).toHaveBeenCalledWith('session-1');
    expect(deleteSessionIfEmpty).toHaveBeenCalledWith('session-0');
    expect(lastFrame()).toContain('session:session-1');
    expect(lastFrame()).not.toContain('ModelManager');
  });

  it('shows SessionManager when /session command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('SessionManager');
  });

  it('opens a selected saved session', async () => {
    const { lastFrame, rerender } = render(<App />);
    await time.tick();
    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onOpenSession?.('saved-session');
    rerender(<App />);
    await time.tick();

    expect(clearScreen).toHaveBeenCalledWith('saved-session');
    expect(deleteSessionIfEmpty).toHaveBeenCalledWith('session-0');
    expect(lastFrame()).toContain('session:saved-session');
    expect(lastFrame()).not.toContain('SessionManager');
  });

  it('returns to chat when the current session is selected', async () => {
    const { lastFrame, rerender } = render(<App />);
    await time.tick();
    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onOpenSession?.('session-0');
    rerender(<App />);
    await time.tick();

    expect(loadSession).not.toHaveBeenCalledWith('session-0');
    expect(clearScreen).not.toHaveBeenCalledWith('session-0');
    expect(deleteSessionIfEmpty).not.toHaveBeenCalledWith('session-0');
    expect(lastFrame()).toContain('session:session-0');
    expect(lastFrame()).not.toContain('SessionManager');
  });

  it('loads the initial session when a resume id is provided', () => {
    render(<App sessionId="resumed-session" />);
    expect(loadSession).toHaveBeenCalledWith('resumed-session');
  });

  it('renders setup-needed content when no model is configured', async () => {
    const { config } = await import('@/utils');
    vi.mocked(config.loadConfig).mockReturnValueOnce({
      host: 'http://localhost:11434',
      model: undefined,
      searxngBaseUrl: undefined,
      theme: 'github-dark',
    });

    const { lastFrame } = render(<App />);
    await time.tick();

    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Select or download a model');
    expect(lastFrame()).not.toContain('session:');
    expect(checkHealth).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
  });

  it('renders setup-needed content when no models are installed', async () => {
    listModels.mockResolvedValueOnce([]);

    const { lastFrame } = render(<App />);
    await time.tick();
    await time.tick();

    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Download a model');
    expect(lastFrame()).not.toContain('session:');
  });

  it('renders setup-needed content when Ollama is unreachable', async () => {
    checkHealth.mockResolvedValueOnce(false);

    const { lastFrame } = render(<App />);
    await time.tick();
    await time.tick();

    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Run ollama serve');
    expect(lastFrame()).not.toContain('session:');
    expect(listModels).not.toHaveBeenCalled();
  });

  it('renders model-load error content when listing models fails', async () => {
    listModels.mockRejectedValueOnce(new Error('boom'));

    const { lastFrame } = render(<App />);
    await time.tick();
    await time.tick();

    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Unable to load models: boom');
    expect(lastFrame()).not.toContain('session:');
  });

  it('routes to ModelManager from setup-needed state', async () => {
    const { config } = await import('@/utils');
    vi.mocked(config.loadConfig).mockReturnValueOnce({
      host: 'http://localhost:11434',
      model: undefined,
      searxngBaseUrl: undefined,
      theme: 'github-dark',
    });

    const { lastFrame, rerender } = render(<App />);
    await time.tick();

    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();

    expect(lastFrame()).toContain('ModelManager');
  });

  it('creates a new session from SessionManager', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onNewSession?.();
    rerender(<App />);
    await time.tick();

    expect(clearScreen).toHaveBeenCalledWith('session-1');
    expect(deleteSessionIfEmpty).toHaveBeenCalledWith('session-0');
    expect(lastFrame()).toContain('session:session-1');
  });

  it('deletes a selected session', async () => {
    const { rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onDeleteSession?.('session-0');
    rerender(<App />);
    await time.tick();

    expect(deleteSession).toHaveBeenCalledWith('session-0');
  });

  it('keeps the active session when deleting a different saved session', async () => {
    const { lastFrame, rerender } = render(<App />);

    capturedCallbacks.onCommand?.('/session');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onDeleteSession?.('other-session');
    rerender(<App />);
    await time.tick();

    expect(deleteSession).toHaveBeenCalledWith('other-session');
    expect(lastFrame()).toContain('SessionManager');
  });

  it('persists newly committed messages and skips turn_aborted markers', async () => {
    render(<App />);
    await time.tick();
    appendMessage.mockClear();

    capturedCallbacks.onMessagesChange?.([
      { role: 'user', content: 'saved message' },
      { role: 'user', content: TURN_ABORTED_MESSAGE },
      { role: 'assistant', content: 'saved reply' },
    ]);

    await time.tick();

    expect(appendMessage).toHaveBeenCalledTimes(2);
    expect(appendMessage).toHaveBeenNthCalledWith(
      1,
      'session-0',
      { role: 'user', content: 'saved message' },
      'gemma4',
    );
    expect(appendMessage).toHaveBeenNthCalledWith(
      2,
      'session-0',
      { role: 'assistant', content: 'saved reply' },
      'gemma4',
    );
  });

  it('does not append when transcript length does not grow', async () => {
    const { rerender } = render(<App />);
    await time.tick();

    capturedCallbacks.onMessagesChange?.([{ role: 'user', content: 'saved' }]);
    rerender(<App />);
    await time.tick();
    appendMessage.mockClear();

    capturedCallbacks.onMessagesChange?.([{ role: 'user', content: 'saved' }]);
    rerender(<App />);
    await time.tick();

    expect(appendMessage).not.toHaveBeenCalled();
  });

  it('updates the active session model when the manager saves one', async () => {
    const { rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();

    capturedCallbacks.onSelect?.({ model: 'llama3' });
    rerender(<App />);
    await time.tick();

    expect(updateSessionModel).toHaveBeenCalledWith('session-0', 'llama3');
  });

  it('toggles mode via Footer onToggleMode callback (3-state cycle)', async () => {
    const { lastFrame, rerender } = render(<App />);

    // Initial state: Safe
    expect(lastFrame()).toContain('Mode: Safe');

    // Call the callback passed to Footer - cycles to Auto
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('Mode: Auto');

    // Call again - cycles to Plan
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('Mode: Plan');

    // Call again - cycles back to Safe
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('Mode: Safe');
  });

  it('updates footer mode when Chat changes execution mode', async () => {
    const { lastFrame, rerender } = render(<App />);
    await time.tick();

    expect(lastFrame()).toContain('Mode: Safe');

    capturedCallbacks.onModeChange?.('auto');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('Mode: Auto');

    capturedCallbacks.onModeChange?.('safe');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('Mode: Safe');
  });
});
