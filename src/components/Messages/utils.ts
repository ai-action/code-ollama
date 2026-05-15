import { ROLE } from '../../constants';
import { normalizeCodeBlockContent } from '../CodeBlock';

export interface ContentSegment {
  type: 'text' | 'code' | 'raw';
  content: string;
  language?: string;
}

interface FenceState {
  fence: string;
  indent: string;
  language?: string;
  rawLines: string[];
  ambiguous: boolean;
  rawFenceDepth: number;
}

const FENCE_LINE_REGEX =
  /^(?<indent>[ \t]*)(?<fence>`{3,})(?<language>\w+)?[ \t]*$/;

function flushTextSegment(
  segments: ContentSegment[],
  textLines: string[],
): void {
  const textContent = textLines.join('\n').trim();
  if (textContent) {
    segments.push({ type: 'text', content: textContent });
  }
}

function flushCodeSegment(
  segments: ContentSegment[],
  codeLines: string[],
  fenceState: FenceState,
): void {
  if (fenceState.ambiguous) {
    segments.push({
      type: 'raw',
      content: fenceState.rawLines.join('\n'),
    });
    return;
  }

  const codeContent = normalizeCodeBlockContent(
    codeLines.join('\n'),
    fenceState.indent,
  );
  if (codeContent) {
    segments.push({
      type: 'code',
      content: codeContent,
      language: fenceState.language,
    });
  }
}

export function unwrapRawMarkdownFence(content: string): string | null {
  if (!content.startsWith('```markdown\n') || !content.endsWith('\n```')) {
    return null;
  }

  return content.slice('```markdown\n'.length, -'\n```'.length);
}

export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = content.split('\n');
  const textLines: string[] = [];
  const codeLines: string[] = [];
  let fenceState: FenceState | null = null;

  for (const line of lines) {
    const fenceMatch = FENCE_LINE_REGEX.exec(line);
    if (fenceMatch?.groups) {
      const { indent, fence, language } = fenceMatch.groups;

      if (!fenceState) {
        flushTextSegment(segments, textLines);
        textLines.length = 0;
        fenceState = {
          indent,
          fence,
          language,
          rawLines: [line],
          ambiguous: false,
          rawFenceDepth: 1,
        };
        continue;
      }

      if (indent === fenceState.indent && fence === fenceState.fence) {
        fenceState.rawLines.push(line);

        if (fenceState.ambiguous) {
          if (language) {
            fenceState.rawFenceDepth += 1;
            continue;
          }

          fenceState.rawFenceDepth -= 1;
          if (fenceState.rawFenceDepth === 0) {
            flushCodeSegment(segments, codeLines, fenceState);
            codeLines.length = 0;
            fenceState = null;
          }
          continue;
        }

        if (!language) {
          flushCodeSegment(segments, codeLines, fenceState);
          codeLines.length = 0;
          fenceState = null;
          continue;
        }

        fenceState.ambiguous = true;
        fenceState.rawFenceDepth += 1;
        continue;
      }
    }

    if (fenceState) {
      fenceState.rawLines.push(line);
      codeLines.push(line);
    } else {
      textLines.push(line);
    }
  }

  if (fenceState) {
    textLines.push(...fenceState.rawLines);
  }

  flushTextSegment(segments, textLines);

  return segments;
}

export function getMessageColor(role: string): string | undefined {
  switch (role) {
    case ROLE.USER:
      return 'black';
    case ROLE.ASSISTANT:
      return 'cyan';
    case ROLE.SYSTEM:
      return 'gray';
    default:
      return undefined;
  }
}

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
  const plainSuffix = content.slice(unmatched.index + unmatched.length);

  if (prefix) {
    parts.push({ type: 'markdown', content: prefix });
  }

  if (plainSuffix) {
    parts.push({ type: 'plain', content: plainSuffix });
  }

  return parts;
}
