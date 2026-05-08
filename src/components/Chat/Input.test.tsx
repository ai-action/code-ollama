import { Text, useInput } from 'ink';
import { render } from 'ink-testing-library';
import { useRef, useState } from 'react';

import { COMMAND, KEY } from '../../constants';
import { time } from '../../utils';

const { mockExit } = vi.hoisted(() => ({
  mockExit: vi.fn(),
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useApp: vi.fn(() => ({
    exit: mockExit,
  })),
}));

vi.mock('@inkjs/ui', () => ({
  TextInput: ({
    defaultValue,
    isDisabled,
    onChange,
    onSubmit,
    placeholder,
  }: {
    defaultValue?: string;
    isDisabled?: boolean;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
  }) => {
    const [value, setValue] = useState(defaultValue ?? '');
    const valueRef = useRef(defaultValue ?? '');
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;

    useInput((input, key) => {
      if (isDisabled) {
        return;
      }

      if (key.return) {
        onSubmitRef.current?.(valueRef.current);
        return;
      }

      if (key.backspace || key.delete) {
        const nextValue = valueRef.current.slice(0, -1);
        valueRef.current = nextValue;
        onChangeRef.current?.(nextValue);
        setValue(nextValue);
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

      const nextValue = valueRef.current + input;
      valueRef.current = nextValue;
      onChangeRef.current?.(nextValue);
      setValue(nextValue);
    });

    return (
      <>
        <Text>{value === '' ? (placeholder ?? '') : value}</Text>
        {value ? (
          <Text dimColor>{`[value:${value}]`}</Text>
        ) : (
          <Text dimColor>{`[placeholder:${placeholder ?? ''}]`}</Text>
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
    onSelect: (value: string) => void;
  }) => {
    const match = /(^|\s)@(\S+)$/.exec(input);
    if (!match) {
      return null;
    }

    const options = [
      'src/components/Chat/Input.tsx',
      'src/utils/tools.ts',
    ].filter((value) => value.toLowerCase().includes(match[2].toLowerCase()));

    const [focusedIndex, setFocusedIndex] = useState(0);
    const prefix = input.slice(0, match.index + match[1].length);
    const activeSuggestion = options[focusedIndex]
      ? `${prefix}${options[focusedIndex]} `
      : null;
    onChange?.(activeSuggestion);

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
        onSelect(`${prefix}${options[focusedIndex]} `);
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

import { Input } from './Input';

describe('Input', () => {
  beforeEach(() => {
    mockExit.mockReset();
  });

  it('renders input prompt', () => {
    const { lastFrame } = render(<Input onSubmit={vi.fn()} />);
    expect(lastFrame()).toContain('>');
    expect(lastFrame()).toContain('Ask anything... (/ commands, @ files)');
    expect(lastFrame()).toContain(
      '[placeholder:Ask anything... (/ commands, @ files)]',
    );
  });

  it('does not show command suggestion on non-slash input', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await time.tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows command list below the input when typing /', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await time.tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    expect(lastFrame()).toContain('/clear');
    expect(lastFrame()).toContain('/model - switch the model');
  });

  it('does not show file suggestions for a bare @', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await time.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('shows file suggestions for @ followed by non-whitespace characters', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
    expect(lastFrame()).toContain('src/utils/tools.ts');
  });

  it('filters the command list to matching slash commands', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await time.tick();
    stdin.write('m');
    await time.tick();

    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('prefers slash command suggestions over file suggestions', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await time.tick();
    stdin.write('m');
    await time.tick();
    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('submits typed text on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('h');
    await time.tick();
    stdin.write('i');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });

  it('inserts the focused file suggestion on Enter with a trailing space', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(lastFrame()).toContain('[value:src/components/Chat/Input.tsx ]');
  });

  it('submits first matching slash command on Enter when list is visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).toHaveBeenCalledWith('/clear');
  });

  it('ignores slash command submissions that are not in the command list', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await time.tick();
    stdin.write('u');
    await time.tick();
    stdin.write('n');
    await time.tick();
    stdin.write('k');
    await time.tick();
    stdin.write('n');
    await time.tick();
    stdin.write('o');
    await time.tick();
    stdin.write('w');
    await time.tick();
    stdin.write('n');
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('inserts the focused file suggestion on Tab with a trailing space', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
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

  it('replaces only the active mention token when inserting a file suggestion', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    for (const character of 'read @s') {
      stdin.write(character);
      await time.tick();
    }

    stdin.write(KEY.TAB);
    await time.tick();
    stdin.write('x');
    await time.tick();
    expect(lastFrame()).toContain('read src/components/Chat/Input.tsx x');
  });

  it('moves focus through file suggestions with arrow keys', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
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
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick(10);
    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(lastFrame()).toContain('[value:src/utils/tools.ts ]');
  });

  it('does not submit or change input on Enter when no file suggestion matches', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('@');
    await time.tick();
    stdin.write('z');
    await time.tick(10);
    stdin.write(KEY.ENTER);
    await time.tick(10);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('[value:@z]');
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await time.tick();
    stdin.write('i');
    await time.tick();
    expect(lastFrame()).toContain('[value:hi]');
    stdin.write(KEY.ENTER);
    await time.tick(10);
    expect(lastFrame()).not.toContain('[value:hi]');
    expect(lastFrame()).toContain(
      '[placeholder:Ask anything... (/ commands, @ files)]',
    );
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
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
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
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
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('hi');
    await time.tick();
    expect(lastFrame()).toContain('[value:hi]');
    stdin.write(KEY.CTRL_C);
    await time.tick();
    expect(lastFrame()).not.toContain('[value:hi]');
    expect(lastFrame()).toContain(
      '[placeholder:Ask anything... (/ commands, @ files)]',
    );
  });

  it('calls exit on Ctrl+C when input is empty', async () => {
    const { stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write(KEY.CTRL_C);
    await time.tick();
    expect(mockExit).toHaveBeenCalledOnce();
  });

  it('does not accept input when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <Input isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('h');
    await time.tick();
    expect(lastFrame()).not.toContain('[value:h]');
    expect(lastFrame()).toContain(
      '[placeholder:Ask anything... (/ commands, @ files)]',
    );
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores file suggestion interactions when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <Input isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('@');
    await time.tick();
    stdin.write('s');
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
