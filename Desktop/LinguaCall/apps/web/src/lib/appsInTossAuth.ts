import React, { createContext, useContext, useEffect, useState } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';

const SESSION_STORAGE_KEY = 'appsintoss_jwt';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function performLogin(): Promise<string> {
  const { authorizationCode, referrer } = await appLogin();

  const res = await fetch(`${API_BASE}/auth/apps-in-toss/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!res.ok) throw new Error('login_failed');

  const body = await res.json() as { ok: boolean; data?: { token?: string } };
  const token = body.data?.token;
  if (typeof token !== 'string' || !token) throw new Error('no_token_in_response');
  return token;
}

interface AppsInTossAuthState {
  token: string | null;
  ready: boolean;
  error: string | null;
  getToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

const AppsInTossAuthContext = createContext<AppsInTossAuthState | null>(null);

export function AppsInTossAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async () => {
    try {
      const jwt = await performLogin();
      sessionStorage.setItem(SESSION_STORAGE_KEY, jwt);
      setToken(jwt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login_failed');
      setToken(null);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void doLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToken = async () => token;
  const refreshSession = async () => { await doLogin(); };

  return React.createElement(
    AppsInTossAuthContext.Provider,
    { value: { token, ready, error, getToken, refreshSession } },
    children
  );
}

export function useAppsInTossAuth(): AppsInTossAuthState {
  const ctx = useContext(AppsInTossAuthContext);
  if (!ctx) throw new Error('useAppsInTossAuth must be used within AppsInTossAuthProvider');
  return ctx;
}
