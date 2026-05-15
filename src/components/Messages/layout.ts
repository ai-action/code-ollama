import { UI } from '../../constants';
import { renderMarkdown } from '../Markdown';

const ANSI_REGEX = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');
const CODE_BLOCK_MARGIN_Y = 2;
const CODE_BLOCK_BORDER_Y = 2;
const CODE_BLOCK_CHROME_X = 4;

export function stripAnsi(value: string): string {
  return value.replaceAll(ANSI_REGEX, '');
}

function countLineWidth(value: string): number {
  return Array.from(stripAnsi(value)).length;
}

export function countWrappedLines(content: string, width: number): number {
  const safeWidth = Math.max(1, width);

  return content.split('\n').reduce((lineCount, line) => {
    const visibleWidth = countLineWidth(line);
    return lineCount + Math.max(1, Math.ceil(visibleWidth / safeWidth));
  }, 0);
}

export function getCodeBlockHeight(content: string, width: number): number {
  const contentWidth = Math.max(1, width - CODE_BLOCK_CHROME_X);
  return (
    CODE_BLOCK_MARGIN_Y +
    CODE_BLOCK_BORDER_Y +
    countWrappedLines(content, contentWidth)
  );
}

export function getStreamingTextHeight(
  textParts: readonly { content: string; type: 'markdown' | 'plain' }[],
  width: number,
): number {
  return textParts.reduce((height, part) => {
    const rendered =
      part.type === 'markdown'
        ? renderMarkdown(part.content, width)
        : part.content;
    return height + countWrappedLines(rendered, width);
  }, 0);
}

export function getAssistantContentWidth(columns: number): number {
  return Math.max(1, columns - UI.AGENT_MARGIN_X * 2);
}
