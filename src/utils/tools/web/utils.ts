import { UI } from '../../../constants';

/**
 * Strip HTML tags from a string
 */
export function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

/**
 * Decode HTML entities
 */
export function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Clean whitespace in text
 */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}${UI.ELLIPSIS}`
    : value;
}
