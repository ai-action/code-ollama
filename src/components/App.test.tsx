import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { time } from '../utils';

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

vi.mock('../utils', async () => ({
  ...(await vi.importActual('../utils')),
  agents: {
    resetSystemMessage,
  },
  config: {
    loadConfig: vi.fn(() => ({
      host: 'http://localhost:11434',
      model: 'gemma4',
      searxngBaseUrl: undefined,
    })),
    saveConfig: vi.fn(),
  },
  screen: {
    clear: clearScreen,
  },
}));

const capturedCallbacks = vi.hoisted(() => ({
  onCommand: null as ((command: string) => void) | null,
  onModeChange: null as ((mode: string) => void) | null,
  onSelect: null as ((update: { model: string }) => void) | null,
  onSaveSearch: null as ((update: { searxngBaseUrl?: string }) => void) | null,
  onClose: null as (() => void) | null,
  onToggleMode: null as (() => void) | null,
}));

vi.mock('./Header', () => ({
  Header: ({ model, onLoad }: { model: string; onLoad: () => void }) => {
    onLoad();
    return <Text>Code Ollama model: {model}</Text>;
  },
}));

vi.mock('./Chat', () => ({
  Chat: ({
    onCommand,
    onModeChange,
    sessionId,
  }: {
    model: string;
    onCommand: (command: string) => void;
    mode: string;
    onModeChange: (mode: string) => void;
    sessionId: number;
  }) => {
    capturedCallbacks.onCommand = onCommand;
    capturedCallbacks.onModeChange = onModeChange;
    return <Text>{`> session:${String(sessionId)}`}</Text>;
  },
}));

vi.mock('./ModelPicker', () => ({
  ModelPicker: ({
    onSelect,
    onClose,
  }: {
    currentModel: string;
    onSelect: (update: { model: string }) => void;
    onClose: () => void;
  }) => {
    capturedCallbacks.onSelect = onSelect;
    capturedCallbacks.onClose = onClose;
    return <Text>ModelPicker</Text>;
  },
}));

vi.mock('./SearchSettings', () => ({
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

vi.mock('./Footer', () => ({
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

import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    capturedCallbacks.onCommand = null;
    capturedCallbacks.onModeChange = null;
    capturedCallbacks.onSelect = null;
    capturedCallbacks.onSaveSearch = null;
    capturedCallbacks.onClose = null;
    capturedCallbacks.onToggleMode = null;
    resetSystemMessage.mockClear();
    clearScreen.mockClear();
    mockExit.mockReset();
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

  it('shows ModelPicker when /model command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('ModelPicker');
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
    expect(lastFrame()).not.toContain('ModelPicker');
  });

  it('returns to chat when onClose is called', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await time.tick();
    capturedCallbacks.onClose?.();
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).not.toContain('ModelPicker');
    expect(lastFrame()).toContain('>');
  });

  it('shows SearchSettings when /search command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/search');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).toContain('SearchSettings');
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

  it('does not open ModelPicker for unknown commands', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/unknown');
    rerender(<App />);
    await time.tick();
    expect(lastFrame()).not.toContain('ModelPicker');
  });

  it('calls exit when /exit command is issued', () => {
    render(<App />);
    capturedCallbacks.onCommand?.('/exit');
    expect(mockExit).toHaveBeenCalledOnce();
  });

  it('resets the chat session when /clear is issued', async () => {
    const { lastFrame, rerender } = render(<App />);

    expect(lastFrame()).toContain('session:0');

    capturedCallbacks.onCommand?.('/clear');
    rerender(<App />);
    await time.tick();

    expect(resetSystemMessage).toHaveBeenCalledOnce();
    expect(clearScreen).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('session:1');
    expect(lastFrame()).not.toContain('ModelPicker');
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
