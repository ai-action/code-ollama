import { Text, useInput } from 'ink';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  isDisabled?: boolean;
  placeholder?: string;
  cursorPosition?: number;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function TextInput({
  value,
  isDisabled = false,
  placeholder,
  cursorPosition: externalCursorPosition,
  onChange,
  onSubmit,
}: Props) {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const prevValueRef = useRef(value);
  const prevExternalCursorRef = useRef(externalCursorPosition);

  // Sync external cursor position prop
  useEffect(() => {
    if (
      externalCursorPosition !== undefined &&
      externalCursorPosition !== prevExternalCursorRef.current
    ) {
      prevExternalCursorRef.current = externalCursorPosition;
      setCursorPosition(externalCursorPosition);
    }
  }, [externalCursorPosition]);

  // Detect external value changes (e.g., file suggestion) and move cursor to end
  useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;

    if (value === '') {
      setCursorPosition(0);
      // v8 ignore start
    } else if (
      // External value change (file suggestion) - value grew by more than 1 char
      value.length > prevValue.length + 1 &&
      cursorPosition <= prevValue.length &&
      externalCursorPosition === undefined
    ) {
      setCursorPosition(value.length);
    } else if (cursorPosition > value.length) {
      // Cursor clamp when value shortened
      setCursorPosition(value.length);
      // v8 ignore stop
    }
  }, [value, cursorPosition, externalCursorPosition]);

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

  const cursorChar = displayValue[cursorPosition] || ' ';
  const before = displayValue.slice(0, cursorPosition);
  const after = displayValue.slice(cursorPosition + 1);

  return (
    <>
      <Text dimColor={isPlaceholder}>{before}</Text>
      <Text inverse>{cursorChar}</Text>
      <Text dimColor={isPlaceholder}>{after}</Text>
    </>
  );
}
