import { Text } from 'ink';

import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

interface MockSelectPromptProps {
  children?: React.ReactNode;
  onCancel?: () => void;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

interface MockTextInputProps {
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  value: string;
  wrapIndent?: number;
}

const { checkHealth, mockSelectPrompt, mockTextInput } = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  mockSelectPrompt: vi.fn<(props: MockSelectPromptProps) => void>(),
  mockTextInput: vi.fn<(props: MockTextInputProps) => void>(),
}));

const inputHandlers: ((
  input: string,
  key: { ctrl?: boolean; escape?: boolean },
) => void)[] = [];

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useInput: (
    handler: (input: string, key: { ctrl?: boolean; escape?: boolean }) => void,
  ) => {
    inputHandlers.push(handler);
  },
}));

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label: string }) => <Text>{label}</Text>,
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  ollama: { checkHealth },
}));

vi.mock('../SelectPrompt', () => ({
  SelectPrompt: (props: MockSelectPromptProps) => {
    mockSelectPrompt(props);
    return (
      <>
        {props.children}
        {props.options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },
  SelectPromptHint: ({ message }: { message?: string }) => (
    <Text>{message}</Text>
  ),
}));

vi.mock('../TextInput', () => ({
  TextInput: (props: MockTextInputProps) => {
    mockTextInput(props);
    return <Text>{props.value || props.placeholder}</Text>;
  },
}));

import { HostSettings } from './HostSettings';

const defaultProps = {
  configuredHost: 'http://remote:11434',
  effectiveHost: 'http://remote:11434',
  source: 'file' as const,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

describe('HostSettings', () => {
  beforeEach(() => {
    inputHandlers.length = 0;
    checkHealth.mockReset();
    mockSelectPrompt.mockReset();
    mockTextInput.mockReset();
  });

  it('shows the effective host and available actions', () => {
    const { lastFrame } = renderWithTheme(<HostSettings {...defaultProps} />);

    expect(lastFrame()).toContain('Current Ollama host: http://remote:11434');
    expect(lastFrame()).toContain('Update Ollama host');
    expect(lastFrame()).toContain('Reset Ollama host');
  });

  it('warns when OLLAMA_HOST overrides the saved host', () => {
    const { lastFrame } = renderWithTheme(
      <HostSettings
        {...defaultProps}
        effectiveHost="http://environment:11434"
        source="environment"
      />,
    );

    expect(lastFrame()).toContain('⚠️ OLLAMA_HOST overrides the saved host');
  });

  it('resets the configured host', () => {
    const onSave = vi.fn();
    renderWithTheme(<HostSettings {...defaultProps} onSave={onSave} />);

    mockSelectPrompt.mock.calls[0]?.[0].onChange('reset');

    expect(onSave).toHaveBeenCalledWith(undefined);
  });

  it('closes when cancel is selected', () => {
    const onClose = vi.fn();
    renderWithTheme(<HostSettings {...defaultProps} onClose={onClose} />);

    mockSelectPrompt.mock.calls[0]?.[0].onChange('cancel');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Set action label when no host is configured', () => {
    const { lastFrame } = renderWithTheme(
      <HostSettings
        {...defaultProps}
        configuredHost={undefined}
        effectiveHost="http://localhost:11434"
      />,
    );

    expect(lastFrame()).toContain('Set Ollama host');
    expect(lastFrame()).not.toContain('Reset Ollama host');
  });

  it('validates URLs before checking connectivity', async () => {
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('ftp://remote:11434');
    await time.tick();

    expect(lastFrame()).toContain('URL must use http or https');
    expect(checkHealth).not.toHaveBeenCalled();
  });

  it('rejects an empty URL submission', async () => {
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('   ');
    await time.tick();

    expect(lastFrame()).toContain('Enter a URL or press Esc to cancel');
    expect(checkHealth).not.toHaveBeenCalled();
  });

  it('rejects a non-URL string submission', async () => {
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('not-a-url');
    await time.tick();

    expect(lastFrame()).toContain('Enter a valid URL');
    expect(checkHealth).not.toHaveBeenCalled();
  });

  it('shows a spinner while checking connectivity', async () => {
    checkHealth.mockReturnValue(new Promise(() => undefined));
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('http://new-host:11434');
    await time.tick();

    expect(lastFrame()).toContain('Checking Ollama connection...');
  });

  it('keeps the editor open when the host is unreachable', async () => {
    checkHealth.mockResolvedValue(false);
    const onSave = vi.fn();
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} onSave={onSave} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} onSave={onSave} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('http://new-host:11434');
    await time.tick();

    expect(lastFrame()).toContain('Could not connect to the Ollama host');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('normalizes and saves a reachable host', async () => {
    checkHealth.mockResolvedValue(true);
    const onSave = vi.fn();
    const { rerender } = renderWithTheme(
      <HostSettings {...defaultProps} onSave={onSave} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} onSave={onSave} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('https://new-host:11434/');
    await time.tick();

    expect(checkHealth).toHaveBeenCalledWith(
      'https://new-host:11434',
      expect.any(AbortSignal),
    );
    expect(onSave).toHaveBeenCalledWith('https://new-host:11434');
  });

  it('shows an error when checkHealth throws an unexpected error', async () => {
    checkHealth.mockRejectedValue(new Error('network error'));
    const onSave = vi.fn();
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} onSave={onSave} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} onSave={onSave} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('http://new-host:11434');
    await time.tick();

    expect(lastFrame()).toContain('Could not connect to the Ollama host');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not show an error when checkHealth is aborted', async () => {
    checkHealth.mockImplementation(
      (_host: string, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('http://new-host:11434');
    await time.tick();

    inputHandlers.at(-1)?.('', { escape: true });
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).not.toContain('Could not connect');
  });

  it('aborts the check and returns to edit view when Escape is pressed while checking', async () => {
    checkHealth.mockReturnValue(new Promise(() => undefined));
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('http://new-host:11434');
    await time.tick();

    expect(lastFrame()).toContain('Checking Ollama connection...');

    inputHandlers.at(-1)?.('', { escape: true });
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).toContain('Enter the URL of the Ollama server');
  });

  it('returns to menu view when Escape is pressed while editing', async () => {
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).toContain('Enter the URL of the Ollama server');

    inputHandlers.at(-1)?.('', { escape: true });
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).toContain('Current Ollama host');
  });

  it('returns to menu view when Ctrl+C is pressed while editing', async () => {
    const { lastFrame, rerender } = renderWithTheme(
      <HostSettings {...defaultProps} />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).toContain('Enter the URL of the Ollama server');

    inputHandlers.at(-1)?.('c', { ctrl: true });
    rerender(<HostSettings {...defaultProps} />);
    await time.tick();

    expect(lastFrame()).toContain('Current Ollama host');
  });

  it('ignores Escape when already in menu view', () => {
    const { lastFrame } = renderWithTheme(<HostSettings {...defaultProps} />);

    inputHandlers.at(-1)?.('', { escape: true });

    expect(lastFrame()).toContain('Current Ollama host');
  });

  it('uses effectiveHost as draft when no configuredHost is set', async () => {
    const { rerender } = renderWithTheme(
      <HostSettings
        {...defaultProps}
        configuredHost={undefined}
        effectiveHost="http://localhost:11434"
      />,
    );
    mockSelectPrompt.mock.calls[0]?.[0].onChange('set');
    rerender(
      <HostSettings
        {...defaultProps}
        configuredHost={undefined}
        effectiveHost="http://localhost:11434"
      />,
    );
    await time.tick();

    expect(mockTextInput.mock.calls[0]?.[0].value).toBe(
      'http://localhost:11434',
    );
  });

  it('ignores input that is not Escape or Ctrl+C', () => {
    const { lastFrame } = renderWithTheme(<HostSettings {...defaultProps} />);

    inputHandlers.at(-1)?.('x', {});

    expect(lastFrame()).toContain('Current Ollama host');
  });
});
