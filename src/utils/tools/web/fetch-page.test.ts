import { webFetch } from './fetch-page';

const mockFetch = vi.fn<typeof fetch>();

describe('fetch-page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('webFetch', () => {
    it('returns error for empty URL', async () => {
      const result = await webFetch('   ');
      expect(result.error).toBe('URL cannot be empty');
    });

    it('returns content from Jina Reader on success', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse('# Page Title\n\nSome content.', 200),
      );

      const result = await webFetch('https://example.com');
      expect(result.content).toBe('# Page Title\n\nSome content.');
      expect(result.error).toBeUndefined();
      const calledUrl = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0];
      expect(calledUrl).toBe('https://r.jina.ai/https://example.com');
    });

    it('falls back to direct fetch when Jina Reader fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('rate limited'))
        .mockResolvedValueOnce(
          createFetchResponse(
            '<html><body><p>Direct content</p></body></html>',
            200,
          ),
        );

      const result = await webFetch('https://example.com');
      expect(result.content).toContain('Note: Jina Reader unavailable');
      expect(result.content).toContain('Direct content');
      expect(result.error).toBeUndefined();
    });

    it('returns error when both Jina and fallback fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('also failed'));

      const result = await webFetch('https://example.com');
      expect(result.error).toContain('Failed to fetch page: also failed');
      expect(result.content).toBe('');
    });

    it('returns error when both fail with non-Error rejection', async () => {
      mockFetch
        .mockRejectedValueOnce('jina string error')
        .mockRejectedValueOnce('fallback string error');

      const result = await webFetch('https://example.com');
      expect(result.error).toContain(
        'Failed to fetch page: fallback string error',
      );
    });

    it('returns error when fallback responds with non-OK status', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('jina down'))
        .mockResolvedValueOnce(createFetchResponse('bad gateway', 502));

      const result = await webFetch('https://example.com');
      expect(result.error).toContain('Failed to fetch page: HTTP 502');
    });

    it('strips HTML tags in fallback content', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('jina error'))
        .mockResolvedValueOnce(
          createFetchResponse(
            '<html><head><title>Title</title></head><body><h1>Heading</h1><p>Paragraph text.</p></body></html>',
            200,
          ),
        );

      const result = await webFetch('https://example.com');
      expect(result.content).toContain('Heading');
      expect(result.content).toContain('Paragraph text.');
      expect(result.content).not.toContain('<h1>');
      expect(result.content).not.toContain('<p>');
    });
  });
});

function createFetchResponse(body: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
