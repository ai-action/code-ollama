import type { ToolResult } from '@/types';

import { fetchText } from './fetch';
import { cleanText, stripTags } from './utils';

const JINA_READER_BASE_URL = 'https://r.jina.ai/';

/**
 * Fetch readable page content via Jina Reader, with fallback to direct fetch + HTML stripping
 */
export async function webFetch(url: string): Promise<ToolResult> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return { content: '', error: 'URL cannot be empty' };
  }

  try {
    const content = await fetchText(`${JINA_READER_BASE_URL}${trimmedUrl}`, {
      Accept: 'text/plain',
    });
    return { content };
  } catch {
    // Fallback: direct fetch + strip HTML
  }

  try {
    const html = await fetchText(trimmedUrl, { Accept: 'text/html' });
    const content = cleanText(stripTags(html));
    return {
      content: `Note: Jina Reader unavailable, falling back to raw fetch.\n\n${content}`,
    };
  } catch (error) {
    return {
      content: '',
      error: `Failed to fetch page: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
