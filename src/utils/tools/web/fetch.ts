import { PACKAGE } from '@/constants';

const FETCH_TIMEOUT_MS = 10_000;

const BASE_HEADERS = {
  'user-agent': `${PACKAGE.NAME}/${PACKAGE.VERSION}`,
};

type Headers = Record<string, string>;

/**
 * Fetch text from URL with timeout and headers
 */
export async function fetchText(
  url: string,
  headers: Headers,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
      ...headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status.toString()}`);
  }

  return response.text();
}

/**
 * Fetch and parse JSON from URL with timeout and headers
 */
export async function fetchJSON<T>(
  url: string,
  headers: Headers = {},
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
      Accept: 'application/json',
      ...headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status.toString()}`);
  }

  return response.json() as Promise<T>;
}
