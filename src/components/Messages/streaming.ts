function isWordCharacter(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9]/.test(char);
}

function isEscaped(content: string, index: number): boolean {
  let slashCount = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && content[cursor] === '\\';
    cursor--
  ) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

interface UnmatchedDelimiter {
  index: number;
  length: number;
}

function canOpenEmphasis(
  content: string,
  index: number,
  length: number,
): boolean {
  const previous = content[index - 1];
  const next = content[index + length];

  if (!next || /\s/.test(next)) {
    return false;
  }

  return !isWordCharacter(previous);
}

function canCloseEmphasis(
  content: string,
  index: number,
  length: number,
): boolean {
  const previous = content[index - 1];
  const next = content[index + length];

  if (!previous || /\s/.test(previous)) {
    return false;
  }

  return !isWordCharacter(next);
}

function findUnmatchedInlineDelimiter(
  content: string,
): UnmatchedDelimiter | null {
  type DelimiterKind = 'code' | 'latex' | 'italic' | 'bold';

  const stack: (UnmatchedDelimiter & {
    kind: DelimiterKind;
    marker: string;
  })[] = [];

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];

    if (isEscaped(content, index)) {
      continue;
    }

    const top = stack.at(-1);

    if (top?.kind === 'code') {
      if (current === '`') {
        stack.pop();
      }
      continue;
    }

    if (top?.kind === 'latex') {
      if (current === '$') {
        stack.pop();
      }
      continue;
    }

    if (current === '`') {
      stack.push({ index, length: 1, kind: 'code', marker: '`' });
      continue;
    }

    if (current === '$') {
      stack.push({ index, length: 1, kind: 'latex', marker: '$' });
      continue;
    }

    if (current !== '*') {
      continue;
    }

    const marker = current;
    const next = content[index + 1];
    const length = next === marker ? 2 : 1;
    const token = marker.repeat(length);
    const kind: DelimiterKind = length === 2 ? 'bold' : 'italic';

    if (
      top?.marker === token &&
      top.kind === kind &&
      canCloseEmphasis(content, index, length)
    ) {
      stack.pop();
      if (length === 2) {
        index += 1;
      }
      continue;
    }

    if (canOpenEmphasis(content, index, length)) {
      stack.push({ index, length, kind, marker: token });
      if (length === 2) {
        index += 1;
      }
    }
  }

  return stack[0] ?? null;
}

interface StreamingInlinePart {
  content: string;
  type: 'markdown' | 'plain';
}

export function splitStreamingInlineContent(
  content: string,
): StreamingInlinePart[] {
  const unmatched = findUnmatchedInlineDelimiter(content);

  if (!unmatched) {
    return [{ type: 'markdown', content }];
  }

  const parts: StreamingInlinePart[] = [];
  const prefix = content.slice(0, unmatched.index);
  const nextLineBreak = content.indexOf('\n', unmatched.index);
  const plainEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
  const plainSuffix = content.slice(
    unmatched.index + unmatched.length,
    plainEnd,
  );
  const trailingContent =
    nextLineBreak === -1 ? '' : content.slice(nextLineBreak);

  if (prefix) {
    parts.push({ type: 'markdown', content: prefix });
  }

  if (plainSuffix) {
    parts.push({ type: 'plain', content: plainSuffix });
  }

  if (trailingContent) {
    parts.push(...splitStreamingInlineContent(trailingContent));
  }

  return parts;
}

export function splitStableStreamingContent(
  content: string,
): StreamingInlinePart[] {
  const lastLineBreak = content.lastIndexOf('\n');

  if (lastLineBreak === -1) {
    return splitStreamingInlineContent(content);
  }

  const stablePrefix = content.slice(0, lastLineBreak + 1);
  const activeTail = content.slice(lastLineBreak + 1);
  const parts: StreamingInlinePart[] = [];

  // v8 ignore next
  if (stablePrefix) {
    parts.push({ type: 'markdown', content: stablePrefix });
  }

  if (activeTail) {
    parts.push(...splitStreamingInlineContent(activeTail));
  }

  return parts;
}
