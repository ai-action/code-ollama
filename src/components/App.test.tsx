import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { tick } from '../utils/test';

const capturedCallbacks = vi.hoisted(() => ({
  onCommand: null as ((command: string) => void) | null,
  onSelect: null as ((model: string) => void) | null,
  onCancel: null as (() => void) | null,
}));

vi.mock('./Chat', () => ({
  Chat: ({
    onCommand,
  }: {
    model: string;
    onCommand: (command: string) => void;
  }) => {
    capturedCallbacks.onCommand = onCommand;
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

import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    capturedCallbacks.onCommand = null;
    capturedCallbacks.onSelect = null;
    capturedCallbacks.onCancel = null;
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
    expect(lastFrame()).toContain('model: llama3');
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
});
