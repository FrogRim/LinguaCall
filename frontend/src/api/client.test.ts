import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('api client request headers', () => {
  it('omits content-type when deleteHarness sends no body and sends bearer auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    const { api, setSessionToken } = await import('./client');
    setSessionToken('session-token');

    await api.deleteHarness('harness-1');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/harnesses/harness-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer session-token',
      },
    });
  });
});
