import { fetchJSON, fetchText } from './fetch';

const mockFetch = vi.fn<typeof fetch>();

describe('web/fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('fetchText', () => {
    it('returns response text on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('hello world'),
      } as unknown as Response);

      const result = await fetchText('https://example.com', {
        Accept: 'text/plain',
      });
      expect(result).toBe('hello world');
    });

    it('throws on non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn(),
      } as unknown as Response);

      await expect(fetchText('https://example.com', {})).rejects.toThrow(
        'HTTP 404',
      );
    });
  });

  describe('fetchJSON', () => {
    it('returns parsed JSON on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ key: 'value' }),
      } as unknown as Response);

      const result = await fetchJSON<{ key: string }>('https://example.com');
      expect(result).toEqual({ key: 'value' });
    });

    it('throws on non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn(),
      } as unknown as Response);

      await expect(fetchJSON('https://example.com')).rejects.toThrow(
        'HTTP 500',
      );
    });
  });
});
