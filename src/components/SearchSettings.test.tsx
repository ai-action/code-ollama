import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { time } from '../utils';

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

const { mockSelectPrompt, mockTextInput } = vi.hoisted(() => ({
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

vi.mock('./SelectPrompt', () => ({
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

vi.mock('./TextInput', () => ({
  TextInput: (props: MockTextInputProps) => {
    mockTextInput(props);
    return <Text>{props.value || props.placeholder}</Text>;
  },
}));

import { SearchSettings } from './SearchSettings';

describe('SearchSettings', () => {
  beforeEach(() => {
    inputHandlers.length = 0;
    mockSelectPrompt.mockReset();
    mockTextInput.mockReset();
  });

  it('shows current status and menu options', () => {
    const { lastFrame } = render(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('https://search.example.com');
    expect(lastFrame()).toContain('Update SearXNG URL');
    expect(lastFrame()).toContain('Clear SearXNG URL');
  });

  it('clears the configured URL', () => {
    const onSave = vi.fn();
    render(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('clear');
    expect(onSave).toHaveBeenCalledWith({ searxngBaseUrl: undefined });
  });

  it('closes when cancel is selected', () => {
    const onClose = vi.fn();
    render(<SearchSettings onClose={onClose} onSave={vi.fn()} />);

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('cancel');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when an unknown action is selected', () => {
    const onClose = vi.fn();
    render(<SearchSettings onClose={onClose} onSave={vi.fn()} />);

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('unexpected');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requires a non-empty URL before saving', async () => {
    const onSave = vi.fn();
    const { lastFrame, rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={onSave} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={onSave} />);
    await time.tick();

    const [textInputCall] = mockTextInput.mock.calls;
    expect(textInputCall).toBeDefined();
    textInputCall[0].onSubmit('   ');
    await time.tick();

    expect(lastFrame()).toContain('Enter a URL or press Esc to cancel.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('passes the prompt indent to the editor input', async () => {
    const { rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={vi.fn()} />);
    await time.tick();

    const [textInputCall] = mockTextInput.mock.calls;
    expect(textInputCall).toBeDefined();
    expect(textInputCall[0].wrapIndent).toBe(2);
  });

  it('validates the entered URL before saving', async () => {
    const onSave = vi.fn();
    const { lastFrame, rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={onSave} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={onSave} />);
    await time.tick();

    const [textInputCall] = mockTextInput.mock.calls;
    expect(textInputCall).toBeDefined();
    textInputCall[0].onSubmit('not-url');
    await time.tick();

    expect(lastFrame()).toContain('Enter a valid URL.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects unsupported URL protocols', async () => {
    const onSave = vi.fn();
    const { lastFrame, rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={onSave} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={onSave} />);
    await time.tick();

    const [textInputCall] = mockTextInput.mock.calls;
    expect(textInputCall).toBeDefined();
    textInputCall[0].onSubmit('ftp://search.example.com');
    await time.tick();

    expect(lastFrame()).toContain('URL must use http or https.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a valid URL', async () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={onSave} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={onSave} />);
    await time.tick();

    const [textInputCall] = mockTextInput.mock.calls;
    expect(textInputCall).toBeDefined();
    textInputCall[0].onSubmit('https://search.example.com');
    await time.tick();

    expect(onSave).toHaveBeenCalledWith({
      searxngBaseUrl: 'https://search.example.com/',
    });
  });

  it('returns to the menu when escape is pressed during editing', async () => {
    const { lastFrame, rerender } = render(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    await time.tick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });
    await time.tick();

    expect(lastFrame()).toContain('SearXNG URL: https://search.example.com');
    expect(lastFrame()).toContain('Clear SearXNG URL');
  });

  it('resets to an empty draft when escape is pressed with no current URL', async () => {
    const { lastFrame, rerender } = render(
      <SearchSettings onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(<SearchSettings onClose={vi.fn()} onSave={vi.fn()} />);
    await time.tick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });
    await time.tick();

    expect(lastFrame()).toContain('SearXNG URL: not set');
    expect(lastFrame()).not.toContain('Clear SearXNG URL');
  });

  it('returns to the menu when ctrl+c is pressed during editing', async () => {
    const { lastFrame, rerender } = render(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    firstCall[0].onChange('set');
    rerender(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    await time.tick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('c', { ctrl: true });
    await time.tick();

    expect(lastFrame()).toContain('SearXNG URL: https://search.example.com');
  });

  it('ignores cancel keys while already on the menu', async () => {
    const { lastFrame } = render(
      <SearchSettings
        currentUrl="https://search.example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });
    await time.tick();

    expect(lastFrame()).toContain('SearXNG URL: https://search.example.com');
    expect(lastFrame()).toContain('Clear SearXNG URL');
  });
});
