import { useRef } from 'react';

import { THEME } from '@/constants';
import { renderWithTheme } from '@/utils/testing';

import { ReadinessCheck, ReadinessState } from './ReadinessCheck';

const mockSubmit = vi.hoisted(() => vi.fn());

vi.mock('@/components/Chat', () => ({
  ChatInput: ({
    onSubmit,
  }: {
    onSubmit: (value: { content: string }) => void;
  }) => {
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;
    // Store the callback for tests to access
    mockSubmit.mockImplementation((value: { content: string }) => {
      onSubmitRef.current(value);
    });
    return null;
  },
}));

vi.mock('@/components/Link', () => ({
  Link: ({ href }: { href: string }) => `blue:${href}`,
}));

describe('ReadinessCheck', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
  });

  it('renders checking state', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.Checking}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Checking Ollama server and model setup');
  });

  it('renders missing model config state', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.MissingModelConfig}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('No Model Configured');
    expect(lastFrame()).toContain('Select or download a model');
    expect(lastFrame()).toContain('/models');
  });

  it('renders no installed models state', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.NoInstalledModels}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('No Model Installed');
    expect(lastFrame()).toContain('Download a model');
    expect(lastFrame()).toContain('/models');
  });

  it('renders model load error state without message', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.ModelLoadError}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Connection Error');
    expect(lastFrame()).toContain('Error loading models');
    expect(lastFrame()).toContain('Fix the connection and restart the app');
  });

  it('renders server unavailable state', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.ServerUnavailable}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Ollama Server Unavailable');
    expect(lastFrame()).toContain(
      'Ollama server is unreachable or not running.',
    );
    expect(lastFrame()).toContain('ollama serve');
    expect(lastFrame()).toContain('https://ollama.com/download');
  });

  it('uses the provided theme for message links and commands', () => {
    const theme = THEME.getTheme('github-light');
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.ServerUnavailable}
        onCommand={vi.fn()}
      />,
      { theme },
    );

    expect(lastFrame()).toContain('blue:https://ollama.com/download');
  });

  it('renders model load error state with message', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.ModelLoadError}
        errorMessage="Connection refused"
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Connection Error');
    expect(lastFrame()).toContain('Error loading models: Connection refused');
  });

  it('renders for Ready state with empty messages', () => {
    const { lastFrame } = renderWithTheme(
      <ReadinessCheck setupState={ReadinessState.Ready} onCommand={vi.fn()} />,
    );
    // No title or message lines are shown
    expect(lastFrame()).not.toContain('Checking Ollama');
    expect(lastFrame()).not.toContain('No model configured');
    expect(lastFrame()).not.toContain('No models installed');
    expect(lastFrame()).not.toContain('Unable to load models');
  });

  it('calls onCommand when ChatInput submits', () => {
    const onCommand = vi.fn();
    renderWithTheme(
      <ReadinessCheck
        setupState={ReadinessState.Ready}
        onCommand={onCommand}
      />,
    );
    // The mock stores the callback in mockSubmit
    mockSubmit({ content: '/models' });
    expect(onCommand).toHaveBeenCalledWith('/models');
  });
});
