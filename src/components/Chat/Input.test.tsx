import { Text, useInput } from 'ink';
import { render } from 'ink-testing-library';
import { useRef, useState } from 'react';

import { COMMAND, KEY } from '../../constants';
import { tick } from '../../utils/test';

vi.mock('@inkjs/ui', () => ({
  TextInput: ({
    isDisabled,
    onChange,
    onSubmit,
  }: {
    isDisabled?: boolean;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
  }) => {
    const [value, setValue] = useState('');
    const valueRef = useRef('');

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

import { Input } from './Input';

describe('Input', () => {
  it('renders input prompt', () => {
    const { lastFrame } = render(<Input onSubmit={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('does not show command suggestion on non-slash input', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows command list below the input when typing /', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    expect(lastFrame()).toContain('/clear');
    expect(lastFrame()).toContain('/model - switch the model');
  });

  it('filters the command list to matching slash commands', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write('m');
    await tick();

    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('submits typed text on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });

  it('submits first matching slash command on Enter when list is visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('/clear');
  });

  it('ignores slash command submissions that are not in the command list', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write('/');
    await tick();
    stdin.write('u');
    await tick();
    stdin.write('n');
    await tick();
    stdin.write('k');
    await tick();
    stdin.write('n');
    await tick();
    stdin.write('o');
    await tick();
    stdin.write('w');
    await tick();
    stdin.write('n');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Input onSubmit={onSubmit} />);
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick(10);
    expect(lastFrame()).not.toContain('hi');
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = render(<Input onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write('c');
    await tick();
    stdin.write(KEY.BACKSPACE);
    await tick();
    expect(lastFrame()).toContain('/clear - clear the current session');
    stdin.write(KEY.BACKSPACE);
    await tick();
    expect(lastFrame()).not.toContain('/clear - clear the current session');
  });

  it('does not accept input when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <Input isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('h');
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
