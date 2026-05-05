import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { tick } from '../utils/test';

vi.mock('../utils', () => ({
  config: {
    loadConfig: vi.fn(() => ({
      host: 'http://localhost:11434',
      model: 'gemma4',
    })),
    saveConfig: vi.fn(),
  },
}));

const capturedCallbacks = vi.hoisted(() => ({
  onCommand: null as ((command: string) => void) | null,
  onModeChange: null as ((mode: string) => void) | null,
  onSelect: null as ((model: string) => void) | null,
  onCancel: null as (() => void) | null,
  onToggleMode: null as (() => void) | null,
}));

vi.mock('./Header', () => ({
  Header: ({ model }: { model: string }) => (
    <Text>Code Ollama model: {model}</Text>
  ),
}));

vi.mock('./Chat', () => ({
  Chat: ({
    onCommand,
    onModeChange,
  }: {
    model: string;
    onCommand: (command: string) => void;
    mode: string;
    onModeChange: (mode: string) => void;
  }) => {
    capturedCallbacks.onCommand = onCommand;
    capturedCallbacks.onModeChange = onModeChange;
    return <Text>{'>'}</Text>;
  },
}));

vi.mock('./ModelPicker', () => ({
  ModelPicker: ({
    onSelect,
    onCancel,
  }: {
    currentModel: string;
    onSelect: (model: string) => void;
    onCancel: () => void;
  }) => {
    capturedCallbacks.onSelect = onSelect;
    capturedCallbacks.onCancel = onCancel;
    return <Text>ModelPicker</Text>;
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
    capturedCallbacks.onCancel = null;
    capturedCallbacks.onToggleMode = null;
  });

  it('renders title', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Code Ollama');
  });

  it('renders chat input', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('>');
  });

  it('shows ModelPicker when /model command is issued', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('ModelPicker');
  });

  it('returns to chat and updates model when onSelect is called', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await tick();
    capturedCallbacks.onSelect?.('llama3');
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('llama3');
    expect(lastFrame()).not.toContain('ModelPicker');
  });

  it('returns to chat when onCancel is called', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/model');
    rerender(<App />);
    await tick();
    capturedCallbacks.onCancel?.();
    rerender(<App />);
    await tick();
    expect(lastFrame()).not.toContain('ModelPicker');
    expect(lastFrame()).toContain('>');
  });

  it('does not open ModelPicker for unknown commands', async () => {
    const { lastFrame, rerender } = render(<App />);
    capturedCallbacks.onCommand?.('/unknown');
    rerender(<App />);
    await tick();
    expect(lastFrame()).not.toContain('ModelPicker');
  });

  it('toggles mode via Footer onToggleMode callback (3-state cycle)', async () => {
    const { lastFrame, rerender } = render(<App />);

    // Initial state: Safe
    expect(lastFrame()).toContain('Mode: Safe');

    // Call the callback passed to Footer - cycles to Auto
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('Mode: Auto');

    // Call again - cycles to Plan
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('Mode: Plan');

    // Call again - cycles back to Safe
    capturedCallbacks.onToggleMode?.();
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('Mode: Safe');
  });

  it('updates footer mode when Chat changes execution mode', async () => {
    const { lastFrame, rerender } = render(<App />);

    expect(lastFrame()).toContain('Mode: Safe');

    capturedCallbacks.onModeChange?.('auto');
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('Mode: Auto');

    capturedCallbacks.onModeChange?.('safe');
    rerender(<App />);
    await tick();
    expect(lastFrame()).toContain('Mode: Safe');
  });
});
