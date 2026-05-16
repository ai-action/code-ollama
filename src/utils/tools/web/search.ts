import type { ToolResult } from '@/types';
import { loadConfig } from '@/utils/config';

import { fetchJSON, fetchText } from './fetch';
import { cleanText, decodeHtml, stripTags, truncate } from './utils';

const SEARCH_RESULT_LIMIT = 5;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string): Promise<ToolResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { content: '', error: 'Search query cannot be empty' };
  }

  const { searxngBaseUrl } = loadConfig();
  let searxngIssue: string | null = null;

  if (searxngBaseUrl) {
    try {
      const searxngResults = await searchSearXNG(searxngBaseUrl, trimmedQuery);
      if (searxngResults.length) {
        return {
          content: formatSearchResults('SearXNG', searxngResults),
        };
      }
      searxngIssue = 'SearXNG returned no results';
    } catch (error) {
      searxngIssue = `SearXNG failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  try {
    const duckDuckGoResults = await searchDuckDuckGo(trimmedQuery);
    if (duckDuckGoResults.length) {
      const note = searxngIssue
        ? `${searxngIssue}. Using DuckDuckGo fallback.`
        : undefined;
      return {
        content: formatSearchResults('DuckDuckGo', duckDuckGoResults, note),
      };
    }

    if (searxngIssue) {
      return {
        content: `No web results found. ${searxngIssue}. DuckDuckGo also returned no results.`,
      };
    }

    return { content: 'No web results found.' };
  } catch (error) {
    const duckDuckGoIssue = `DuckDuckGo failed: ${error instanceof Error ? error.message : String(error)}`;
    return {
      content: '',
      error: searxngIssue
        ? `${searxngIssue}; ${duckDuckGoIssue}`
        : duckDuckGoIssue,
    };
  }
}

async function searchSearXNG(
  baseUrl: string,
  query: string,
): Promise<SearchResult[]> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = new URL(`${normalizedBaseUrl}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'en-US');

  const payload = await fetchJSON<{
    results?: { title?: string; url?: string; content?: string }[];
  }>(url.toString());

  return normalizeResults(
    payload.results?.map((result) => ({
      title: result.title ?? '',
      url: result.url ?? '',
      snippet: result.content ?? '',
    })) ?? [],
  );
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = new URL('https://html.duckduckgo.com/html/');
  url.searchParams.set('q', query);

  const html = await fetchText(url.toString(), {
    Accept: 'text/html',
  });

  return parseDuckDuckGoResults(html);
}

function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/g;

  for (const match of html.matchAll(resultRegex)) {
    const url = normalizeDuckDuckGoUrl(match[1]);
    const title = decodeHtml(stripTags(match[2]));
    const snippet = decodeHtml(stripTags(match[3]));

    if (!url || !title) {
      continue;
    }

    results.push({ title, url, snippet });
    if (results.length >= SEARCH_RESULT_LIMIT) {
      break;
    }
  }

  return normalizeResults(results);
}

function normalizeDuckDuckGoUrl(url: string): string {
  try {
    const parsedUrl = new URL(url, 'https://duckduckgo.com');
    const redirectedUrl = parsedUrl.searchParams.get('uddg');
    return redirectedUrl
      ? decodeURIComponent(redirectedUrl)
      : parsedUrl.toString();
  } catch {
    return url;
  }
}

function normalizeResults(results: SearchResult[]): SearchResult[] {
  return results
    .map((result) => ({
      title: cleanText(result.title),
      url: result.url.trim(),
      snippet: cleanText(result.snippet),
    }))
    .filter((result) => result.title && result.url)
    .slice(0, SEARCH_RESULT_LIMIT);
}

function formatSearchResults(
  source: string,
  results: SearchResult[],
  note?: string,
): string {
  const lines = [`Source: ${source}`];
  if (note) {
    lines.push(`Note: ${note}`);
  }

  for (const [index, result] of results.entries()) {
    lines.push(`${(index + 1).toString()}. ${result.title}`);
    lines.push(`   URL: ${result.url}`);
    if (result.snippet) {
      lines.push(`   Snippet: ${truncate(result.snippet, 240)}`);
    }
  }

  return lines.join('\n');
}
