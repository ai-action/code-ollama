import { Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

interface Props {
  value: string;
  isDisabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function TextInput({
  value,
  isDisabled = false,
  placeholder,
  onChange,
  onSubmit,
}: Props) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  // Reset cursor when value is cleared (e.g., Ctrl+C reset)
  useEffect(() => {
    if (!value) {
      setCursorPosition(0);
    }
  }, [value]);

  useInput(
    (input, key) => {
      // v8 ignore next
      if (isDisabled) {
        return;
      }

      if (key.return) {
        onSubmit(value);
        setCursorPosition(0);
        return;
      }

      if (key.backspace) {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
        return;
      }

      // v8 ignore start
      if (key.delete) {
        if (cursorPosition < value.length) {
          const newValue =
            value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
          onChange(newValue);
        }
        return;
      }
      // v8 ignore stop

      if (key.leftArrow) {
        setCursorPosition(Math.max(0, cursorPosition - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
        return;
      }

      if (key.home) {
        setCursorPosition(0);
        return;
      }

      if (key.end) {
        setCursorPosition(value.length);
        return;
      }

      // v8 ignore start
      if (input) {
        const newValue =
          value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition + input.length);
      }
      // v8 ignore stop
    },
    { isActive: !isDisabled },
  );

  const displayValue = value || (placeholder ?? '');
  const isPlaceholder = Boolean(!value && placeholder);
  const char = displayValue[cursorPosition] || ' ';
  const before = displayValue.slice(0, cursorPosition);
  const after = displayValue.slice(cursorPosition + 1);
  // Use ANSI codes: dim (2) for placeholder text, inverse (7) for cursor
  const dimStyle = isPlaceholder ? '\x1b[2m' : '';
  const resetDim = isPlaceholder ? '\x1b[22m' : '';
  const output = `${dimStyle}${before}${resetDim}\x1b[7m${char}\x1b[27m${dimStyle}${after}${resetDim}`;

  return <Text>{output}</Text>;
}
