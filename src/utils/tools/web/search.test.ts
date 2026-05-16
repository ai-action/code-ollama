import { loadConfig } from '../../config';
import { webSearch } from './search';

vi.mock('../../config', () => ({
  loadConfig: vi.fn(() => ({
    host: 'http://localhost:11434',
    model: 'gemma4',
    searxngBaseUrl: undefined,
    theme: 'github-dark',
  })),
}));

const mockLoadConfig = vi.mocked(loadConfig);
const mockFetch = vi.fn<typeof fetch>();

describe('search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockLoadConfig.mockReturnValue({
      host: 'http://localhost:11434',
      model: 'gemma4',
      searxngBaseUrl: undefined,
      theme: 'github-dark',
    });
  });

  describe('webSearch', () => {
    it('executes web_search with SearXNG results', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          JSON.stringify({
            results: [
              {
                title: 'Example Result',
                url: 'https://example.com',
                content: 'Useful snippet',
              },
            ],
          }),
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('Source: SearXNG');
      expect(result.content).toContain('Example Result');
      expect(result.content).toContain('https://example.com');
    });

    it('treats a missing SearXNG results array as empty and falls back', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch
        .mockResolvedValueOnce(createFetchResponse(JSON.stringify({}), 200))
        .mockResolvedValueOnce(
          createFetchResponse(
            `
              <a class="result__a" href="https://example.com">Example Result</a>
              <div class="result__snippet">Fallback snippet</div>
            `,
            200,
          ),
        );

      const result = await webSearch('example');
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).toContain('SearXNG returned no results');
    });

    it('normalizes sparse SearXNG results and omits empty snippets', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          JSON.stringify({
            results: [
              {
                url: 'https://missing-title.example.com',
                content: 'Should be filtered out',
              },
              {
                title: 'Missing URL',
              },
              {
                title: 'Valid Result',
                url: 'https://example.com',
              },
            ],
          }),
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('Valid Result');
      expect(result.content).not.toContain('Should be filtered out');
      expect(result.content).not.toContain('Snippet:');
    });

    it('falls back to DuckDuckGo when SearXNG fails', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(
          createFetchResponse(
            `
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example Result</a>
              <div class="result__snippet">Fallback snippet</div>
            `,
            200,
          ),
        );

      const result = await webSearch('example');
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).toContain('Using DuckDuckGo fallback');
      expect(result.content).toContain('https://example.com');
    });

    it('uses DuckDuckGo directly when no SearXNG URL is configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://example.com">Example Result</a>
            <div class="result__snippet">Snippet</div>
          `,
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('Source: DuckDuckGo');
      expect(result.content).not.toContain('Using DuckDuckGo fallback');
    });

    it('returns no results when both providers are empty', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch
        .mockResolvedValueOnce(
          createFetchResponse(JSON.stringify({ results: [] }), 200),
        )
        .mockResolvedValueOnce(createFetchResponse('<html></html>', 200));

      const result = await webSearch('example');
      expect(result.content).toContain('No web results found');
      expect(result.error).toBeUndefined();
    });

    it('returns an error when both providers fail', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch
        .mockRejectedValueOnce(new Error('SearXNG timeout'))
        .mockRejectedValueOnce(new Error('DuckDuckGo timeout'));

      const result = await webSearch('example');
      expect(result.error).toContain('SearXNG failed: SearXNG timeout');
      expect(result.error).toContain('DuckDuckGo failed: DuckDuckGo timeout');
    });

    it('handles non-Error SearXNG failures', async () => {
      mockLoadConfig.mockReturnValue({
        host: 'http://localhost:11434',
        model: 'gemma4',
        searxngBaseUrl: 'https://search.example.com',
        theme: 'github-dark',
      });
      mockFetch.mockRejectedValueOnce('searxng exploded').mockResolvedValueOnce(
        createFetchResponse(
          `
              <a class="result__a" href="https://example.com">Example Result</a>
              <div class="result__snippet">Fallback snippet</div>
            `,
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('SearXNG failed: searxng exploded');
    });

    it('rejects empty search queries', async () => {
      const result = await webSearch('   ');
      expect(result.error).toBe('Search query cannot be empty');
    });

    it('returns an HTTP error when DuckDuckGo responds with a non-OK status', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse('bad gateway', 502));

      const result = await webSearch('example');
      expect(result.error).toContain('DuckDuckGo failed: HTTP 502');
    });

    it('handles non-Error DuckDuckGo failures', async () => {
      mockFetch.mockRejectedValueOnce('duckduckgo exploded');

      const result = await webSearch('example');
      expect(result.error).toContain('DuckDuckGo failed: duckduckgo exploded');
    });

    it('skips invalid DuckDuckGo results and caps output at five entries', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://skip.test"></a>
            <div class="result__snippet">Skip me</div>
            <a class="result__a" href="https://example1.com">Result 1</a>
            <div class="result__snippet">Snippet 1</div>
            <a class="result__a" href="https://example2.com">Result 2</a>
            <div class="result__snippet">Snippet 2</div>
            <a class="result__a" href="https://example3.com">Result 3</a>
            <div class="result__snippet">Snippet 3</div>
            <a class="result__a" href="https://example4.com">Result 4</a>
            <div class="result__snippet">Snippet 4</div>
            <a class="result__a" href="https://example5.com">Result 5</a>
            <div class="result__snippet">Snippet 5</div>
            <a class="result__a" href="https://example6.com">Result 6</a>
            <div class="result__snippet">Snippet 6</div>
          `,
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('Result 1');
      expect(result.content).toContain('Result 5');
      expect(result.content).not.toContain('Result 6');
      expect(result.content).not.toContain('Skip me');
    });

    it('truncates long snippets in formatted search output', async () => {
      const longSnippet = 'a'.repeat(300);
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="https://example.com">Example Result</a>
            <div class="result__snippet">${longSnippet}</div>
          `,
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('Snippet:');
      expect(result.content).toContain('…');
      expect(result.content).not.toContain(longSnippet);
    });

    it('preserves malformed DuckDuckGo URLs when URL normalization fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse(
          `
            <a class="result__a" href="http://%">Odd Result</a>
            <div class="result__snippet">Odd snippet</div>
          `,
          200,
        ),
      );

      const result = await webSearch('example');
      expect(result.content).toContain('http://%');
    });

    it('returns no results when DuckDuckGo has no matches and SearXNG is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse('<html></html>', 200),
      );

      const result = await webSearch('example');
      expect(result.content).toBe('No web results found.');
      expect(result.error).toBeUndefined();
    });
  });
});

function createFetchResponse(body: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
    json: vi
      .fn()
      .mockImplementation(() => Promise.resolve(JSON.parse(body) as unknown)),
  } as unknown as Response;
}
