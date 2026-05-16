import { normalizeCodeBlockContent } from '@/components/CodeBlock';

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
