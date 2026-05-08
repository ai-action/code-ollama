import { Text, useInput } from 'ink';
import { render } from 'ink-testing-library';
import { useRef, useState } from 'react';

import { COMMAND, KEY } from '../../constants';
import { test } from '../../utils';

vi.mock('@inkjs/ui', () => ({
  TextInput: ({
    defaultValue,
    isDisabled,
    onChange,
    onSubmit,
  }: {
    defaultValue?: string;
    isDisabled?: boolean;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
  }) => {
    const [value, setValue] = useState(defaultValue ?? '');
    const valueRef = useRef(defaultValue ?? '');

    useInput((input, key) => {
      if (isDisabled) {
        return;
      }

      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.backspace || key.delete) {
        const nextValue = valueRef.current.slice(0, -1);
        valueRef.current = nextValue;
        onChange?.(nextValue);
        setValue(nextValue);
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
      onChange?.(nextValue);
      setValue(nextValue);
    });

    return <Text>{value}</Text>;
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
    onSelect,
  }: {
    input: string;
    isDisabled?: boolean;
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

    useInput((_, key) => {
      if (isDisabled || options.length === 0) {
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
        const prefix = input.slice(0, match.index + match[1].length);
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
  it('renders input prompt', () => {
    const { lastFrame } = render(<Input onSubmit={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('does not show command suggestion on non-slash input', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await test.tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows command list below the input when typing /', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await test.tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    expect(lastFrame()).toContain('/clear');
    expect(lastFrame()).toContain('/model - switch the model');
  });

  it('does not show file suggestions for a bare @', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await test.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('shows file suggestions for @ followed by non-whitespace characters', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await test.tick();
    stdin.write('s');
    await test.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
    expect(lastFrame()).toContain('src/utils/tools.ts');
  });

  it('filters the command list to matching slash commands', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await test.tick();
    stdin.write('m');
    await test.tick();

    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('prefers slash command suggestions over file suggestions', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await test.tick();
    stdin.write('m');
    await test.tick();
    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('submits typed text on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('h');
    await test.tick();
    stdin.write('i');
    await test.tick();
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });

  it('submits typed text on Enter while file suggestions are visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('read @s');
    await test.tick();
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).toHaveBeenCalledWith('read @s');
  });

  it('submits first matching slash command on Enter when list is visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await test.tick();
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).toHaveBeenCalledWith('/clear');
  });

  it('ignores slash command submissions that are not in the command list', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await test.tick();
    stdin.write('u');
    await test.tick();
    stdin.write('n');
    await test.tick();
    stdin.write('k');
    await test.tick();
    stdin.write('n');
    await test.tick();
    stdin.write('o');
    await test.tick();
    stdin.write('w');
    await test.tick();
    stdin.write('n');
    await test.tick();
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('inserts the focused file suggestion on Tab with a trailing space', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await test.tick();
    stdin.write('s');
    await test.tick();
    stdin.write(KEY.TAB);
    await test.tick();
    stdin.write('x');
    await test.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx x');
  });

  it('replaces only the active mention token when inserting a file suggestion', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    for (const character of 'read @s') {
      stdin.write(character);
      await test.tick();
    }

    stdin.write(KEY.TAB);
    await test.tick();
    stdin.write('x');
    await test.tick();
    expect(lastFrame()).toContain('read src/components/Chat/Input.tsx x');
  });

  it('moves focus through file suggestions with arrow keys', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await test.tick();
    stdin.write('s');
    await test.tick();
    stdin.write(KEY.DOWN);
    await test.tick();
    stdin.write(KEY.TAB);
    await test.tick();
    stdin.write('x');
    await test.tick();
    expect(lastFrame()).toContain('src/utils/tools.ts x');
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await test.tick();
    stdin.write('i');
    await test.tick();
    stdin.write(KEY.ENTER);
    await test.tick(10);
    expect(lastFrame()).not.toContain('hi');
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await test.tick();
    stdin.write('c');
    await test.tick();
    stdin.write(KEY.BACKSPACE);
    await test.tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    stdin.write(KEY.BACKSPACE);
    await test.tick();
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('closes file suggestions when backspace removes the active mention query', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('@');
    await test.tick();
    stdin.write('s');
    await test.tick();
    expect(lastFrame()).toContain('src/components/Chat/Input.tsx');
    stdin.write(KEY.BACKSPACE);
    await test.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
  });

  it('does not accept input when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <Input isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('h');
    await test.tick();
    expect(lastFrame()).not.toContain('h');
    stdin.write(KEY.ENTER);
    await test.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores file suggestion interactions when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <Input isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('@');
    await test.tick();
    stdin.write('s');
    await test.tick();
    stdin.write(KEY.TAB);
    await test.tick();
    expect(lastFrame()).not.toContain('src/components/Chat/Input.tsx');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
