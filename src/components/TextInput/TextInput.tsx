import { Box, Text, useInput, usePaste, useStdout } from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  value: string;
  isDisabled?: boolean;
  placeholder?: string;
  cursorPosition?: number;
  allowMultilinePaste?: boolean;
  multiline?: boolean;
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

interface CursorRow {
  maxPosition: number;
  start: number;
}

function getCursorRows(value: string, width: number): CursorRow[] {
  const rows: CursorRow[] = [];
  const logicalLines = value.split('\n');
  let lineStart = 0;

  for (const [lineIndex, line] of logicalLines.entries()) {
    const rowCount = Math.max(1, Math.ceil((line.length + 1) / width));
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const start = lineStart + rowIndex * width;
      rows.push({
        start,
        maxPosition:
          rowIndex === rowCount - 1
            ? lineStart + line.length
            : start + width - 1,
      });
    }

    lineStart += line.length + (lineIndex < logicalLines.length - 1 ? 1 : 0);
  }

  return rows;
}

export function TextInput({
  value,
  isDisabled = false,
  placeholder,
  cursorPosition: externalCursorPosition,
  allowMultilinePaste = false,
  multiline = false,
  wrapIndent = 0,
  onChange,
  onSubmit,
}: Props) {
  const { stdout } = useStdout();
  const [cursorPosition, setCursorPosition] = useState(
    externalCursorPosition ?? value.length,
  );
  const prevValueRef = useRef(value);
  const prevExternalCursorRef = useRef(externalCursorPosition);
  const preferredColumnRef = useRef<number | null>(null);

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
      preferredColumnRef.current = null;
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

      const hasPastedNewlines =
        allowMultilinePaste && input.length > 1 && /[\r\n]/.test(input);

      if (hasPastedNewlines) {
        insertText(normalizePastedText(input));
        return;
      }

      if (key.return) {
        if (multiline) {
          insertText('\n');
        } else {
          onSubmit(value);
        }
        return;
      }

      if (multiline && key.ctrl && input === 's') {
        onSubmit(value);
        return;
      }

      if (key.backspace) {
        if (cursorPosition > 0) {
          const newValue =
            value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
          preferredColumnRef.current = null;
        }
        return;
      }

      // v8 ignore start
      if (key.delete) {
        if (cursorPosition < value.length) {
          const newValue =
            value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
          onChange(newValue);
          preferredColumnRef.current = null;
        }
        return;
      }
      // v8 ignore stop

      if (key.leftArrow) {
        setCursorPosition(Math.max(0, cursorPosition - 1));
        preferredColumnRef.current = null;
        return;
      }

      if (key.rightArrow) {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
        preferredColumnRef.current = null;
        return;
      }

      if (multiline && (key.upArrow || key.downArrow)) {
        const rows = getCursorRows(
          value,
          Math.max(1, stdout.columns - wrapIndent),
        );
        const currentRowIndex = rows.findIndex(
          ({ maxPosition, start }) =>
            cursorPosition >= start && cursorPosition <= maxPosition,
        );
        const currentRow = rows[currentRowIndex];
        const preferredColumn =
          preferredColumnRef.current ?? cursorPosition - currentRow.start;
        preferredColumnRef.current = preferredColumn;
        const targetIndex = Math.max(
          0,
          Math.min(rows.length - 1, currentRowIndex + (key.upArrow ? -1 : 1)),
        );
        const targetRow = rows[targetIndex];
        setCursorPosition(
          Math.min(targetRow.start + preferredColumn, targetRow.maxPosition),
        );
        return;
      }

      if (key.home) {
        setCursorPosition(
          multiline
            ? value.lastIndexOf('\n', Math.max(0, cursorPosition - 1)) + 1
            : 0,
        );
        preferredColumnRef.current = null;
        return;
      }

      if (key.end) {
        const lineEnd = value.indexOf('\n', cursorPosition);
        setCursorPosition(multiline && lineEnd >= 0 ? lineEnd : value.length);
        preferredColumnRef.current = null;
        return;
      }

      // Ctrl+A moves cursor to start
      if (key.ctrl && input === 'a') {
        setCursorPosition(0);
        preferredColumnRef.current = null;
        return;
      }

      // Ctrl+E moves cursor to end
      if (key.ctrl && input === 'e') {
        setCursorPosition(value.length);
        preferredColumnRef.current = null;
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
