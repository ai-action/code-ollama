import { PACKAGE } from '@/constants';

import { checkForUpdate } from './update';

describe('checkForUpdate', () => {
  const fetchMock = vi.spyOn(global, 'fetch');

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('returns latest version when a newer version is available', async () => {
    const parts = PACKAGE.VERSION.split('.');
    const newer = [parts[0], parts[1], String(Number(parts[2]) + 1)].join('.');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: newer }), { status: 200 }),
    );
    await expect(checkForUpdate()).resolves.toBe(newer);
  });

  it('returns undefined when already up-to-date', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: PACKAGE.VERSION }), {
        status: 200,
      }),
    );
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });

  it('returns undefined when current version is newer than registry', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: '0.0.1' }), { status: 200 }),
    );
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });

  it('returns undefined when fetch returns non-200', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });

  it('returns undefined when response has no version field', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });

  it('returns latest version when a newer major version is available', async () => {
    const parts = PACKAGE.VERSION.split('.');
    const newer = [String(Number(parts[0]) + 1), parts[1], parts[2]].join('.');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: newer }), { status: 200 }),
    );
    await expect(checkForUpdate()).resolves.toBe(newer);
  });

  it('returns latest version when a newer minor version is available', async () => {
    const parts = PACKAGE.VERSION.split('.');
    const newer = [parts[0], String(Number(parts[1]) + 1), parts[2]].join('.');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: newer }), { status: 200 }),
    );
    await expect(checkForUpdate()).resolves.toBe(newer);
  });

  it('returns undefined when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });
});
