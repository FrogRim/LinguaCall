import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppLogin = vi.fn();
const mockLogin = vi.fn();
const mockLoginWithAuthorizationCode = vi.fn();
const mockSetSessionToken = vi.fn();

vi.mock('@apps-in-toss/web-framework', () => ({
  appLogin: mockAppLogin,
}));

vi.mock('./api/client', () => ({
  api: {
    login: mockLogin,
    loginWithAuthorizationCode: mockLoginWithAuthorizationCode,
  },
  setSessionToken: mockSetSessionToken,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function loadSubject() {
  const [{ api }, { bootstrapAuth }] = await Promise.all([
    import('./api/client'),
    import('./bootstrapAuth'),
  ]);

  return {
    appLogin: mockAppLogin,
    api,
    setSessionToken: mockSetSessionToken,
    bootstrapAuth,
  };
}

describe('bootstrapAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('logs in with authorizationCode and stores session token', async () => {
    const { appLogin, api, setSessionToken, bootstrapAuth } = await loadSubject();

    appLogin.mockResolvedValue({
      authorizationCode: 'auth-code',
      referrer: 'DEFAULT',
    });
    vi.mocked(api.loginWithAuthorizationCode).mockResolvedValue({
      sessionToken: 'session-token',
      plan: 'FREE',
    });

    const result = await bootstrapAuth();

    expect(result).toEqual({ sessionToken: 'session-token', plan: 'FREE' });
    expect(api.loginWithAuthorizationCode).toHaveBeenCalledWith('auth-code', 'DEFAULT');
    expect(setSessionToken).toHaveBeenCalledWith('session-token');
  });

  it('does not store session token when exchange fails', async () => {
    const { appLogin, api, setSessionToken, bootstrapAuth } = await loadSubject();

    appLogin.mockResolvedValue({
      authorizationCode: 'auth-code',
      referrer: 'DEFAULT',
    });
    vi.mocked(api.loginWithAuthorizationCode).mockRejectedValue(new Error('API Error 500'));

    await expect(bootstrapAuth()).rejects.toThrow('API Error 500');
    expect(setSessionToken).not.toHaveBeenCalled();
  });

  it('reuses the in-flight bootstrap request', async () => {
    const { appLogin, api, bootstrapAuth } = await loadSubject();
    const deferred = createDeferred<{ sessionToken: string; plan: string }>();

    appLogin.mockResolvedValue({
      authorizationCode: 'auth-code',
      referrer: 'DEFAULT',
    });
    vi.mocked(api.loginWithAuthorizationCode).mockReturnValue(deferred.promise);

    const firstCall = bootstrapAuth();
    const secondCall = bootstrapAuth();

    expect(appLogin).toHaveBeenCalledTimes(1);
    deferred.resolve({ sessionToken: 'session-token', plan: 'FREE' });

    await expect(Promise.all([firstCall, secondCall])).resolves.toEqual([
      { sessionToken: 'session-token', plan: 'FREE' },
      { sessionToken: 'session-token', plan: 'FREE' },
    ]);
  });

  it('allows retry after a failed bootstrap request', async () => {
    const { appLogin, api, setSessionToken, bootstrapAuth } = await loadSubject();

    appLogin.mockResolvedValue({
      authorizationCode: 'auth-code',
      referrer: 'DEFAULT',
    });
    vi.mocked(api.loginWithAuthorizationCode)
      .mockRejectedValueOnce(new Error('API Error 500'))
      .mockResolvedValueOnce({
        sessionToken: 'session-token',
        plan: 'FREE',
      });

    await expect(bootstrapAuth()).rejects.toThrow('API Error 500');
    await expect(bootstrapAuth()).resolves.toEqual({ sessionToken: 'session-token', plan: 'FREE' });
    expect(setSessionToken).toHaveBeenCalledWith('session-token');
  });

  it('falls back to direct user login on localhost when appLogin is unavailable', async () => {
    vi.stubGlobal('location', {
      hostname: '127.0.0.1',
    } as Location);

    const { appLogin, api, setSessionToken, bootstrapAuth } = await loadSubject();

    appLogin.mockRejectedValue(new Error('appLogin unavailable'));
    vi.mocked(api.login).mockResolvedValue({ sessionToken: 'local-session-token', plan: 'FREE' });

    const result = await bootstrapAuth();

    expect(api.login).toHaveBeenCalledWith('local-dev-user');
    expect(setSessionToken).toHaveBeenCalledWith('local-session-token');
    expect(result).toEqual({ sessionToken: 'local-session-token', plan: 'FREE' });
  });

  it('keeps throwing when appLogin is unavailable outside localhost', async () => {
    vi.stubGlobal('location', {
      hostname: 'mini.apps.tossmini.com',
    } as Location);

    const { appLogin, api, bootstrapAuth } = await loadSubject();

    appLogin.mockRejectedValue(new Error('appLogin unavailable'));

    await expect(bootstrapAuth()).rejects.toThrow('appLogin unavailable');
    expect(api.login).not.toHaveBeenCalled();
  });
});
