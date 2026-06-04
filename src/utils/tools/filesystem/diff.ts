const DIFF_CONTEXT_LINES = 3;
const DIFF_MAX_LINES = 120;
const DIFF_MAX_CHARS = 12_000;

function splitLines(content: string): string[] {
  return content.split('\n');
}

export function createUnifiedDiff(
  filePath: string,
  beforeContent: string,
  afterContent: string,
): string {
  const beforeLines = splitLines(beforeContent);
  const afterLines = splitLines(afterContent);

  let commonPrefix = 0;
  while (
    commonPrefix < beforeLines.length &&
    commonPrefix < afterLines.length &&
    beforeLines[commonPrefix] === afterLines[commonPrefix]
  ) {
    commonPrefix += 1;
  }

  let commonSuffix = 0;
  while (
    commonSuffix < beforeLines.length - commonPrefix &&
    commonSuffix < afterLines.length - commonPrefix &&
    beforeLines[beforeLines.length - 1 - commonSuffix] ===
      afterLines[afterLines.length - 1 - commonSuffix]
  ) {
    commonSuffix += 1;
  }

  const beforeChangeEnd = beforeLines.length - commonSuffix;
  const afterChangeEnd = afterLines.length - commonSuffix;
  const hunkStart = Math.max(0, commonPrefix - DIFF_CONTEXT_LINES);
  const beforeHunkEnd = Math.min(
    beforeLines.length,
    beforeChangeEnd + DIFF_CONTEXT_LINES,
  );
  const afterHunkEnd = Math.min(
    afterLines.length,
    afterChangeEnd + DIFF_CONTEXT_LINES,
  );

  const beforeHunkLines = beforeLines.slice(hunkStart, beforeHunkEnd);
  const afterHunkLines = afterLines.slice(hunkStart, afterHunkEnd);
  const beforeChangedLines = beforeLines.slice(commonPrefix, beforeChangeEnd);
  const afterChangedLines = afterLines.slice(commonPrefix, afterChangeEnd);
  const contextBefore = beforeLines.slice(hunkStart, commonPrefix);
  const contextAfter = beforeLines.slice(beforeChangeEnd, beforeHunkEnd);

  const lines = [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    `@@ -${String(hunkStart + 1)},${String(beforeHunkLines.length)} +${String(hunkStart + 1)},${String(afterHunkLines.length)} @@`,
    ...contextBefore.map((line) => ` ${line}`),
    ...beforeChangedLines.map((line) => `-${line}`),
    ...afterChangedLines.map((line) => `+${line}`),
    ...contextAfter.map((line) => ` ${line}`),
  ];

  return lines.join('\n');
}

export function truncateDiff(diff: string): {
  visible: string;
  truncated: boolean;
  totalLines: number;
  visibleLines: number;
} {
  const lines = diff.split('\n');
  let visibleLines = lines.slice(0, DIFF_MAX_LINES);
  let truncated = lines.length > DIFF_MAX_LINES;

  while (visibleLines.join('\n').length > DIFF_MAX_CHARS) {
    visibleLines = visibleLines.slice(0, -1);
    truncated = true;
  }

  if (truncated) {
    visibleLines = [
      ...visibleLines,
      `[diff truncated: showing ${String(visibleLines.length)} of ${String(lines.length)} lines]`,
    ];
  }

  return {
    visible: visibleLines.join('\n'),
    truncated,
    totalLines: lines.length,
    visibleLines: Math.min(visibleLines.length, lines.length),
  };
}
