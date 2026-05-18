import { render } from 'ink-testing-library';
import { useRef } from 'react';

import { ReadinessCheck, ReadinessState } from './ReadinessCheck';

vi.mock('@/components/Chat', () => ({
  ChatInput: ({ onSubmit }: { onSubmit: (value: string) => void }) => {
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;
    return null;
  },
}));

describe('ReadinessCheck', () => {
  it('renders checking state', () => {
    const { lastFrame } = render(
      <ReadinessCheck
        setupState={ReadinessState.Checking}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Checking Ollama model setup');
  });

  it('renders missing model config state', () => {
    const { lastFrame } = render(
      <ReadinessCheck
        setupState={ReadinessState.MissingModelConfig}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('No model configured');
    expect(lastFrame()).toContain('Use /model to select or download one');
  });

  it('renders no installed models state', () => {
    const { lastFrame } = render(
      <ReadinessCheck
        setupState={ReadinessState.NoInstalledModels}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('No models installed');
    expect(lastFrame()).toContain('Use /model to download one');
  });

  it('renders model load error state without message', () => {
    const { lastFrame } = render(
      <ReadinessCheck
        setupState={ReadinessState.ModelLoadError}
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Unable to load models');
    expect(lastFrame()).toContain('Fix the connection, then use /model');
  });

  it('renders model load error state with message', () => {
    const { lastFrame } = render(
      <ReadinessCheck
        setupState={ReadinessState.ModelLoadError}
        errorMessage="Connection refused"
        onCommand={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Setup Required');
    expect(lastFrame()).toContain('Unable to load models: Connection refused');
  });

  it('renders for Ready state with empty messages', () => {
    const { lastFrame } = render(
      <ReadinessCheck setupState={ReadinessState.Ready} onCommand={vi.fn()} />,
    );
    // Ready state still shows Setup Required but with no message lines
    expect(lastFrame()).toContain('Setup Required');
    // No specific error/instruction messages shown
    expect(lastFrame()).not.toContain('Checking Ollama');
    expect(lastFrame()).not.toContain('No model configured');
    expect(lastFrame()).not.toContain('No models installed');
    expect(lastFrame()).not.toContain('Unable to load models');
  });
});
