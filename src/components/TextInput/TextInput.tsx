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

      if (key.backspace || key.delete) {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
        return;
      }

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

  return (
    <>
      <Text>{displayValue.slice(0, cursorPosition)}</Text>
      <Text inverse>{displayValue[cursorPosition] || ' '}</Text>
      <Text dimColor={isPlaceholder}>
        {displayValue.slice(cursorPosition + 1)}
      </Text>
    </>
  );
}
