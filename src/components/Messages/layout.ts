import { renderMarkdown as renderMarkdownToString } from '@/components/Markdown/render';
import { UI } from '@/constants';

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

/**
 * Counts the number of wrapped lines for a given content and width.
 *
 * This function splits the content by newlines and calculates how many lines
 * each segment would wrap to based on the available width.
 *
 * @param content The text content to wrap.
 * @param width The available width for wrapping.
 * @returns The number of wrapped lines.
 */
export function countWrappedLines(content: string, width: number): number {
  const safeWidth = Math.max(1, width);

  return content.split('\n').reduce((lineCount, line) => {
    const visibleWidth = countLineWidth(line);
    return lineCount + Math.max(1, Math.ceil(visibleWidth / safeWidth));
  }, 0);
}

/**
 * Calculates the height of a code block based on its content and width.
 *
 * This function accounts for margins, borders, and wrapped lines to determine
 * the total height required for displaying a code block.
 *
 * @param content The code block content to render.
 * @param width The available width for the code block.
 * @returns The total height in lines.
 */
export function getCodeBlockHeight(content: string, width: number): number {
  const contentWidth = Math.max(1, width - CODE_BLOCK_CHROME_X);
  return (
    CODE_BLOCK_MARGIN_Y +
    CODE_BLOCK_BORDER_Y +
    countWrappedLines(content, contentWidth)
  );
}

/**
 * Calculates the total height of streaming text content based on wrapped lines.
 *
 * @param textParts Array of text parts with their content and type.
 * @param width The available width for wrapping text.
 * @returns The total height in lines.
 */
export function getStreamingTextHeight(
  textParts: readonly { content: string; type: 'markdown' | 'plain' }[],
  width: number,
): number {
  return textParts.reduce((height, part) => {
    const renderMarkdown: (content: string, hrWidth: number) => string =
      renderMarkdownToString;

    const rendered =
      part.type === 'markdown'
        ? renderMarkdown(part.content, width)
        : part.content;

    return height + countWrappedLines(rendered, width);
  }, 0);
}

/**
 * Calculates the available width for assistant content after accounting for margins.
 *
 * @param columns The total number of columns in the terminal.
 * @returns The available width for content (always at least 1).
 */
export function getAssistantContentWidth(columns: number): number {
  return Math.max(1, columns - UI.SCREEN_MARGIN_X * 2);
}
