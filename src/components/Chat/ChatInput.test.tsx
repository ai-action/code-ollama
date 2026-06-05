import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Text, useInput } from 'ink';
import { render } from 'ink-testing-library';
import { type ComponentProps, useRef, useState } from 'react';

import { COMMAND, KEY } from '@/constants';
import { clipboard, time } from '@/utils';

const { mockExit } = vi.hoisted(() => ({
  mockExit: vi.fn(),
}));

const { mockTextInput } = vi.hoisted(() => ({
  mockTextInput: vi.fn(),
}));

const { mockClipboard } = vi.hoisted(() => ({
  mockClipboard: {
    removeClipboardImage: vi.fn(),
    saveClipboardImage: vi.fn(),
  },
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useApp: vi.fn(() => ({
    exit: mockExit,
  })),
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  clipboard: mockClipboard,
}));

vi.mock('../TextInput', () => ({
  TextInput: ({
    value,
    isDisabled,
    cursorPosition,
    allowMultilinePaste,
    wrapIndent,
    onChange,
    onSubmit,
    placeholder,
  }: {
    value?: string;
    isDisabled?: boolean;
    cursorPosition?: number;
    allowMultilinePaste?: boolean;
    wrapIndent?: number;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
  }) => {
    mockTextInput({
      value,
      isDisabled,
      cursorPosition,
      allowMultilinePaste,
      wrapIndent,
      onChange,
      onSubmit,
      placeholder,
    });
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;

    useInput((input, key) => {
      if (isDisabled) {
        return;
      }

      if (key.return) {
        onSubmitRef.current?.(value ?? '');
        return;
      }

      if (key.backspace || key.delete) {
        const nextValue = (value ?? '').slice(0, -1);
        onChangeRef.current?.(nextValue);
        return;
      }

      if (key.ctrl) {
        return;
      }

      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        return;
      }

      if (key.tab) {
        return;
      }

      if (!input) {
        return;
      }

      const nextValue = (value ?? '') + input;
      onChangeRef.current?.(nextValue);
    });

    return (
      <>
        {value === '' || value === undefined ? (
          <Text dimColor>{placeholder ?? ''}</Text>
        ) : (
          <Text>{value}</Text>
        )}
      </>
    );
  },
}));

vi.mock('./CommandMenu', () => ({
  CommandMenu: ({
    input,
    onSubmit,
  }: {
    input: string;
    onSubmit: (value: string) => void;
  }) => {
    const normalizedInput = input.trim().toLowerCase();
    const options =
      normalizedInput === '/unknown'
        ? [
            {
              label: '/unknown - invalid command',
              value: '/unknown',
            },
          ]
        : COMMAND.LIST.filter(({ name }) =>
            name.toLowerCase().startsWith(normalizedInput),
          ).map(({ name, description }) => ({
            label: `${name} - ${description}`,
            value: name,
          }));

    useInput((_, key) => {
      if (key.return && options[0]) {
        onSubmit(options[0].value);
      }
    });

    if (!options.length) {
      return null;
    }

    return (
      <>
        {options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },
}));

vi.mock('./FileSuggestions', () => ({
  FileSuggestions: ({
    input,
    isDisabled,
    onChange,
    onSelect,
  }: {
    input: string;
    isDisabled?: boolean;
    onChange?: (value: string | null) => void;
    onSelect: (value: { value: string; cursorPosition: number }) => void;
  }) => {
    const match = /(^|.)@(\S+)/.exec(input);
    if (!match) {
      return null;
    }

    const options = [
      'src/components/Chat/Input.tsx',
      'src/utils/tools.ts',
    ].filter((value) => value.toLowerCase().includes(match[2].toLowerCase()));

    const [focusedIndex, setFocusedIndex] = useState(0);
    const prefix = input.slice(0, match.index + match[1].length);
    const queryEndIndex = prefix.length + 1 + match[2].length;
    const suffix = input.slice(queryEndIndex);
    const separator = !suffix.length || !/\s/.test(suffix[0]) ? ' ' : '';
    const value = options[focusedIndex]
      ? `${prefix}${options[focusedIndex]}${separator}${suffix}`
      : null;
    onChange?.(value);

    useInput((_, key) => {
      if (isDisabled || !options.length) {
        return;
      }

      if (key.downArrow) {
        setFocusedIndex((index) => Math.min(index + 1, options.length - 1));
        return;
      }

      if (key.upArrow) {
        setFocusedIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (key.tab) {
        const selectedValue = `${prefix}${options[focusedIndex]}${separator}${suffix}`;
        onSelect({
          value: selectedValue,
          cursorPosition: selectedValue.length - suffix.length,
        });
      }
    });

    if (!options.length) {
      return null;
    }

    return (
      <>
        {options.map((option, index) => (
          <Text key={option}>
            {index === focusedIndex ? '>' : ' '} {option}
          </Text>
        ))}
      </>
    );
  },
}));

import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  let testDirectory = '';

  function renderInput(props: Partial<ComponentProps<typeof ChatInput>> = {}) {
    return render(<ChatInput history={[]} onSubmit={vi.fn()} {...props} />);
  }

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'code-ollama-chat-input-'));
    writeFileSync(join(testDirectory, 'screen.png'), 'png');
    mockExit.mockReset();
    mockTextInput.mockReset();
    mockClipboard.removeClipboardImage.mockReset();
    mockClipboard.saveClipboardImage.mockReset();
    mockClipboard.saveClipboardImage.mockReturnValue(
      join(testDirectory, 'image-1.png'),
    );
  });

  afterEach(() => {
    rmSync(testDirectory, { force: true, recursive: true });
  });

  it('renders input prompt', () => {
    const { lastFrame } = renderInput();
    expect(lastFrame()).toContain('>');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('does not show command suggestion on non-slash input', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('h');
    await time.tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows command list below the input when typing /', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('/');
    await time.tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    expect(lastFrame()).toContain('/clear');
    expect(lastFrame()).toContain(
      '/compact - summarize conversation and prune context',
    );
    expect(lastFrame()).toContain('/model - manage Ollama models');
    expect(lastFrame()).toContain('/search - configure web search');
  });

  it('does not show file suggestions for a bare @', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('shows file suggestions for @ followed by non-whitespace characters', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
    expect(lastFrame()).toContain('src/utils/tools.ts');
  });

  it('filters the command list to matching slash commands', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('/');
    await time.tick();
    stdin.write('m');
    await time.tick();

    expect(lastFrame()).toContain('/model - manage Ollama models');
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('prefers slash command suggestions over file suggestions', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('/');
    await time.tick();
    stdin.write('m');
    await time.tick();
    expect(lastFrame()).toContain('/model - manage Ollama models');
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('submits typed text on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInput({ onSubmit });
    stdin.write('h');
    await time.tick();
    stdin.write('i');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).toHaveBeenCalledWith({ content: 'hi' });
  });

  it('enables multiline paste in the text input', () => {
    renderInput();

    expect(mockTextInput.mock.calls.at(-1)?.[0]).toMatchObject({
      allowMultilinePaste: true,
    });
  });

  it('submits pasted multiline text as one chat message', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInput({ onSubmit });

    stdin.write('line one\nline two');
    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith({
      content: 'line one\nline two',
    });
  });

  it('submits multiline text starting with slash as chat text', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ onSubmit });

    stdin.write('/not-a-command\nexplain it');
    await time.tick(10);

    expect(lastFrame()).not.toContain('/not-a-command - invalid command');

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith({
      content: '/not-a-command\nexplain it',
    });
  });

  it('inserts the focused file suggestion on Enter with a trailing space', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
  });

  it('submits first matching slash command on Enter when list is visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInput({ onSubmit });
    stdin.write('/');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).toHaveBeenCalledWith({ content: '/clear' });
  });

  it('ignores slash command submissions that are not in the command list', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInput({ onSubmit });
    stdin.write('/unknown');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stages pasted image paths as attachments and keeps the remaining text', async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderInput({ onSubmit });
    const inputProps = mockTextInput.mock.calls.at(-1)?.[0] as
      | { onChange?: (value: string) => void }
      | undefined;

    inputProps?.onChange?.(
      `"${join(testDirectory, 'screen.png')}" explain this`,
    );
    await time.tick();

    expect(lastFrame()).toContain('[screen.png]');
    expect(lastFrame()).toContain('explain this');

    const updatedInputProps = mockTextInput.mock.calls.at(-1)?.[0] as
      | { onSubmit?: (value: string) => void }
      | undefined;
    updatedInputProps?.onSubmit?.('explain this');
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith({
      content: 'explain this',
      images: [join(testDirectory, 'screen.png')],
    });
  });

  it('stages a clipboard image on Ctrl+V', async () => {
    const { lastFrame, stdin } = renderInput();

    stdin.write('\x16');
    await time.tick();

    expect(clipboard.saveClipboardImage).toHaveBeenCalledWith('image-1');
    expect(lastFrame()).toContain('[image-1.png]');
  });

  it('hides the placeholder when an attachment is staged without typed text', async () => {
    const { lastFrame, stdin } = renderInput();

    stdin.write('\x16');
    await time.tick();

    expect(lastFrame()).toContain('[image-1.png]');
    expect(lastFrame()).not.toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('shows a clipboard error when image paste fails', async () => {
    mockClipboard.saveClipboardImage.mockImplementationOnce(() => {
      throw new Error('Clipboard unavailable');
    });

    const { lastFrame, stdin } = renderInput();
    stdin.write('\x16');
    await time.tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Clipboard unavailable');
    expect(frame.indexOf('Clipboard unavailable')).toBeLessThan(
      frame.indexOf('>'),
    );
  });

  it('shows a clipboard error when image paste throws a non-Error value', async () => {
    mockClipboard.saveClipboardImage.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'String error';
    });

    const { lastFrame, stdin } = renderInput();
    stdin.write('\x16');
    await time.tick();

    expect(lastFrame()).toContain('String error');
  });

  it('removes the last staged attachment on backspace when the input is empty', async () => {
    const { lastFrame, stdin } = renderInput();

    stdin.write('\x16');
    await time.tick();
    expect(lastFrame()).toContain('[image-1.png]');

    stdin.write(KEY.BACKSPACE);
    await time.tick();

    expect(lastFrame()).not.toContain('[image-1.png]');
    expect(clipboard.removeClipboardImage).toHaveBeenCalledWith(
      join(testDirectory, 'image-1.png'),
    );
  });

  it('does not remove attachment on backspace when there are no attachments', async () => {
    const { lastFrame, stdin } = renderInput();

    stdin.write(KEY.BACKSPACE);
    await time.tick();

    // Placeholder should still show
    expect(lastFrame()).toContain('Ask anything...');
    expect(clipboard.removeClipboardImage).not.toHaveBeenCalled();
  });

  it('cleans up staged temp attachments when the session changes', async () => {
    const onSubmit = vi.fn();
    const { rerender, stdin } = renderInput({ onSubmit });

    stdin.write('\x16');
    await time.tick();

    rerender(<ChatInput history={['next session']} onSubmit={onSubmit} />);
    await time.tick();

    expect(clipboard.removeClipboardImage).toHaveBeenCalledWith(
      join(testDirectory, 'image-1.png'),
    );
  });

  it('does not clean up non-temp attachments when session changes', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, rerender } = renderInput({ onSubmit });
    const inputProps = mockTextInput.mock.calls.at(-1)?.[0] as
      | { onChange?: (value: string) => void }
      | undefined;

    // Stage a file path attachment (non-temp)
    inputProps?.onChange?.(`"${join(testDirectory, 'screen.png')}"`);
    await time.tick();

    expect(lastFrame()).toContain('[screen.png]');

    // Change session - should not clean up non-temp attachment
    rerender(<ChatInput history={['next session']} onSubmit={onSubmit} />);
    await time.tick();

    expect(clipboard.removeClipboardImage).not.toHaveBeenCalled();
  });

  it('does not clean up non-temp attachments when removed', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ onSubmit });
    const inputProps = mockTextInput.mock.calls.at(-1)?.[0] as
      | { onChange?: (value: string) => void }
      | undefined;

    // Stage a file path attachment (non-temp)
    inputProps?.onChange?.(`"${join(testDirectory, 'screen.png')}"`);
    await time.tick();

    expect(lastFrame()).toContain('[screen.png]');

    stdin.write(KEY.BACKSPACE);
    await time.tick();

    expect(lastFrame()).not.toContain('[screen.png]');
    expect(clipboard.removeClipboardImage).not.toHaveBeenCalled();
  });

  it('inserts the focused file suggestion on Tab with a trailing space', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();
    stdin.write('x');
    await time.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx x');
  });

  it('passes the file suggestion cursor position through to TextInput', async () => {
    const { stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();

    const lastCall = mockTextInput.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    expect(lastCall?.[0]).toMatchObject({
      value: 'src/components/Chat/Input.tsx ',
      cursorPosition: 'src/components/Chat/Input.tsx '.length,
      wrapIndent: 2,
    });
  });

  it('replaces only the active mention token when inserting a file suggestion', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('read @s');
    await time.tick(10);

    stdin.write(KEY.TAB);
    await time.tick();
    stdin.write('x');
    await time.tick();
    expect(lastFrame()).toContain('read src/components/Chat/Input.tsx x');
  });

  it('moves focus through file suggestions with arrow keys', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();
    stdin.write('x');
    await time.tick();
    expect(lastFrame()).toContain('src/utils/tools.ts x');
  });

  it('inserts the focused file suggestion on Enter after arrow navigation', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick(10);
    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(lastFrame()).toContain('src/utils/tools.ts');
  });

  it('does not submit or change input on Enter when no file suggestion matches', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ onSubmit });
    stdin.write('@');
    await time.tick();
    stdin.write('z');
    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick(10);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('@z');
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInput({ onSubmit });
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ onSubmit });
    stdin.write('x');
    await time.tick();
    stdin.write('y');
    await time.tick();
    expect(lastFrame()).toContain('xy');
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(onSubmit).toHaveBeenCalledWith({ content: 'xy' });
    expect(lastFrame()).not.toContain('xy');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('/');
    await time.tick();
    stdin.write('c');
    await time.tick();
    stdin.write(KEY.BACKSPACE);
    await time.tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    stdin.write(KEY.BACKSPACE);
    await time.tick();
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('closes file suggestions when backspace removes the active mention query', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
    stdin.write(KEY.BACKSPACE);
    await time.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('clears input on Ctrl+C when input is non-empty', async () => {
    const { lastFrame, stdin } = renderInput();
    stdin.write('xy');
    await time.tick();
    expect(lastFrame()).toContain('xy');
    stdin.write(KEY.CTRL_C);
    await time.tick();
    expect(lastFrame()).not.toContain('xy');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('calls exit on Ctrl+C when input is empty', async () => {
    const { stdin } = renderInput();
    stdin.write(KEY.CTRL_C);
    await time.tick();
    expect(mockExit).toHaveBeenCalledOnce();
  });

  it('does not accept input when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ isDisabled: true, onSubmit });
    stdin.write('h');
    await time.tick();
    expect(lastFrame()).not.toContain('> h');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onInterrupt on Ctrl+C when disabled', async () => {
    const onInterrupt = vi.fn();
    const { stdin } = renderInput({ isDisabled: true, onInterrupt });
    stdin.write(KEY.CTRL_C);
    await time.tick();
    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('calls onInterrupt on Esc when disabled', async () => {
    const onInterrupt = vi.fn();
    const { stdin } = renderInput({ isDisabled: true, onInterrupt });
    stdin.write(KEY.ESCAPE);
    await time.tick(20);
    expect(onInterrupt).toHaveBeenCalledOnce();
  });

  it('does not call onInterrupt when not disabled', async () => {
    const onInterrupt = vi.fn();
    const { stdin } = renderInput({ onInterrupt });
    stdin.write(KEY.ESCAPE);
    await time.tick();
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('ignores file suggestion interactions when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderInput({ isDisabled: true, onSubmit });
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('recalls the most recent prompt with Up on blank input', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['first prompt', 'second prompt'],
    });

    stdin.write(KEY.UP);
    await time.tick();

    expect(lastFrame()).toContain('second prompt');
  });

  it('steps backward and forward through prompt history', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['first prompt', 'second prompt'],
    });

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('second prompt');

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('first prompt');

    stdin.write(KEY.DOWN);
    await time.tick();
    expect(lastFrame()).toContain('second prompt');
  });

  it('returns to blank input when navigating past the newest history entry', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['only prompt'],
    });

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('only prompt');

    stdin.write(KEY.DOWN);
    await time.tick();
    expect(lastFrame()).not.toContain('only prompt');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('does not navigate history when the input is non-empty and not already navigating', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['old prompt'],
    });

    stdin.write('n');
    await time.tick();
    stdin.write(KEY.UP);
    await time.tick();

    expect(lastFrame()).toContain('n');
    expect(lastFrame()).not.toContain('old prompt');
  });

  it('does not navigate past the oldest history entry on repeated "up" presses', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['only prompt'],
    });

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('only prompt');

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('only prompt');
  });

  it('ignores "down" arrow when not navigating history', async () => {
    const { lastFrame, stdin } = renderInput({
      history: ['old prompt'],
    });

    stdin.write('n');
    await time.tick();
    stdin.write(KEY.DOWN);
    await time.tick();

    expect(lastFrame()).toContain('n');
    expect(lastFrame()).not.toContain('old prompt');
  });

  it('does not add slash commands to prompt history after a session change', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, rerender, stdin } = renderInput({
      onSubmit,
    });

    stdin.write('/');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();

    rerender(<ChatInput history={[]} onSubmit={onSubmit} />);
    await time.tick();

    stdin.write(KEY.UP);
    await time.tick();

    expect(lastFrame()).not.toContain('/clear');
    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );
  });

  it('resets prompt history state when the session changes', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, rerender, stdin } = renderInput({
      history: ['session one prompt'],
      onSubmit,
    });

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('session one prompt');

    rerender(
      <ChatInput history={['session two prompt']} onSubmit={onSubmit} />,
    );
    await time.tick();

    expect(lastFrame()).toContain(
      'Ask anything... (/ commands, @ files, Ctrl+V images)',
    );

    stdin.write(KEY.UP);
    await time.tick();
    expect(lastFrame()).toContain('session two prompt');
  });
});
