import { render } from 'ink-testing-library';
import type React from 'react';

interface MockSelectPromptProps {
  children?: React.ReactNode;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  options: { label: string; value: string }[];
}

const { mockSelectPrompt, mockSelectPromptHint } = vi.hoisted(() => ({
  mockSelectPrompt: vi.fn<(props: MockSelectPromptProps) => void>(),
  mockSelectPromptHint: vi.fn<(props: { escapeLabel?: string }) => void>(),
}));

vi.mock('../SelectPrompt', async () => {
  const { Text } = await import('ink');

  return {
    SelectPrompt: (props: {
      children?: React.ReactNode;
      onCancel?: () => void;
      onChange?: (value: string) => void;
      options: { label: string; value: string }[];
    }) => {
      mockSelectPrompt(props);
      return (
        <>
          {props.children}
          {props.options.map((option) => (
            <Text key={option.value}>{option.label}</Text>
          ))}
        </>
      );
    },
    SelectPromptHint: (props: { escapeLabel?: string }) => {
      mockSelectPromptHint(props);
      return <Text>{`Select option to ${props.escapeLabel ?? ''}`}</Text>;
    },
  };
});

import { DirectoryTrustPrompt } from './DirectoryTrustPrompt';

function getSelectPromptProps() {
  return mockSelectPrompt.mock.calls[0][0];
}

describe('DirectoryTrustPrompt', () => {
  beforeEach(() => {
    mockSelectPrompt.mockClear();
    mockSelectPromptHint.mockClear();
  });

  it('renders the trust message, options, and exit hint', () => {
    const { lastFrame } = render(
      <DirectoryTrustPrompt
        directory="/resolved/project"
        onDecision={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Trust this directory?');
    expect(frame).toContain('/resolved/project');
    expect(frame).toContain('prompt');
    expect(frame).toContain('injection');
    expect(frame).toContain('Yes, trust and continue');
    expect(frame).toContain('No, exit');
    expect(mockSelectPromptHint).toHaveBeenCalledWith({ escapeLabel: 'exit' });
  });

  it('accepts trust when the trust option is selected', () => {
    const onDecision = vi.fn();
    render(
      <DirectoryTrustPrompt
        directory="/resolved/project"
        onDecision={onDecision}
      />,
    );

    getSelectPromptProps().onChange?.('trust');

    expect(onDecision).toHaveBeenCalledWith(true);
  });

  it('rejects trust when the exit option is selected', () => {
    const onDecision = vi.fn();
    render(
      <DirectoryTrustPrompt
        directory="/resolved/project"
        onDecision={onDecision}
      />,
    );

    getSelectPromptProps().onChange?.('exit');

    expect(onDecision).toHaveBeenCalledWith(false);
  });

  it('rejects trust when the prompt is canceled', () => {
    const onDecision = vi.fn();
    render(
      <DirectoryTrustPrompt
        directory="/resolved/project"
        onDecision={onDecision}
      />,
    );

    getSelectPromptProps().onCancel?.();

    expect(onDecision).toHaveBeenCalledWith(false);
  });
});
