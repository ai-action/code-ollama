import { Box, Text, useInput, usePaste, useStdout } from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  value: string;
  isDisabled?: boolean;
  placeholder?: string;
  cursorPosition?: number;
  allowMultilinePaste?: boolean;
  wrapIndent?: number;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

interface LineSegment {
  text: string;
  hasCursor: boolean;
  beforeCursor: string;
  cursorChar: string;
  afterCursor: string;
}

function buildLineSegments(
  displayValue: string,
  cursorPosition: number,
  width: number,
): LineSegment[] {
  const safeWidth = Math.max(1, width);
  const lines: LineSegment[] = [];
  const logicalLines = displayValue.split('\n');
  let lineStart = 0;

  for (const [lineIndex, logicalLine] of logicalLines.entries()) {
    const lineEnd = lineStart + logicalLine.length;
    const hasCursorOnLine =
      cursorPosition >= lineStart && cursorPosition <= lineEnd;
    const cursorOffset = cursorPosition - lineStart;
    const renderValue =
      hasCursorOnLine && cursorOffset === logicalLine.length
        ? `${logicalLine} `
        : logicalLine;
    const totalLength = Math.max(1, renderValue.length);

    for (let start = 0; start < totalLength; start += safeWidth) {
      const end = start + safeWidth;
      const text = renderValue.slice(start, end);
      const hasCursor =
        hasCursorOnLine && cursorOffset >= start && cursorOffset < end;

      if (!hasCursor) {
        lines.push({
          text,
          hasCursor,
          beforeCursor: '',
          cursorChar: ' ',
          afterCursor: '',
        });
        continue;
      }

      const offset = cursorOffset - start;
      lines.push({
        text,
        hasCursor,
        beforeCursor: text.slice(0, offset),
        cursorChar: text[offset],
        afterCursor: text.slice(offset + 1),
      });
    }

    lineStart = lineEnd + (lineIndex < logicalLines.length - 1 ? 1 : 0);
  }

  return lines;
}

function normalizePastedText(input: string) {
  return input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

export function TextInput({
  value,
  isDisabled = false,
  placeholder,
  cursorPosition: externalCursorPosition,
  allowMultilinePaste = false,
  wrapIndent = 0,
  onChange,
  onSubmit,
}: Props) {
  const { stdout } = useStdout();
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

  const insertText = useCallback(
    (text: string) => {
      const newValue =
        value.slice(0, cursorPosition) + text + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + text.length);
    },
    [cursorPosition, onChange, value],
  );

  usePaste(
    (text) => {
      insertText(normalizePastedText(text));
    },
    { isActive: allowMultilinePaste && !isDisabled },
  );

  useInput(
    (input, key) => {
      // v8 ignore next
      if (isDisabled) {
        return;
      }

      const hasPastedNewlines = allowMultilinePaste && /[\r\n]/.test(input);

      if (hasPastedNewlines) {
        insertText(normalizePastedText(input));
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

      // Ctrl+A moves cursor to start
      if (key.ctrl && input === 'a') {
        setCursorPosition(0);
        return;
      }

      // Ctrl+E moves cursor to end
      if (key.ctrl && input === 'e') {
        setCursorPosition(value.length);
        return;
      }

      if (key.ctrl) {
        return;
      }

      // v8 ignore start
      if (input) {
        insertText(input);
      }
      // v8 ignore stop
    },
    { isActive: !isDisabled },
  );

  const displayValue = value || (placeholder ?? '');
  const isPlaceholder = Boolean(!value && placeholder);
  const availableWidth = Math.max(1, stdout.columns - wrapIndent);
  const lines = useMemo(
    () => buildLineSegments(displayValue, cursorPosition, availableWidth),
    [availableWidth, cursorPosition, displayValue],
  );

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={`${String(index)}-${line.text}`}>
          {line.hasCursor ? (
            <>
              <Text dimColor={isPlaceholder}>{line.beforeCursor}</Text>
              <Text inverse>{line.cursorChar}</Text>
              <Text dimColor={isPlaceholder}>{line.afterCursor}</Text>
            </>
          ) : (
            <Text dimColor={isPlaceholder}>{line.text}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}
