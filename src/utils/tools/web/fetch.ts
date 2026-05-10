import { PACKAGE } from '../../../constants';

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetch text from URL with timeout and headers
 */
export async function fetchText(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': `${PACKAGE.NAME}/${PACKAGE.VERSION}`,
      ...headers,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status.toString()}`);
  }

  return response.text();
}
