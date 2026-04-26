import React, { createContext, useContext, useEffect, useState } from 'react';
import { requestAppsInTossLogin } from './hostBridge';
import { getHostRuntime } from './hostRuntime';

const SESSION_STORAGE_KEY = 'appsintoss_jwt';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type LoginResult = { authorizationCode?: string; authorization_code?: string; referrer?: string };

function readLoginResult(value: unknown): { authorizationCode: string; referrer: string } | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as LoginResult;
  const authorizationCode = (typeof v.authorizationCode === 'string' ? v.authorizationCode : typeof v.authorization_code === 'string' ? v.authorization_code : '').trim();
  const referrer = (typeof v.referrer === 'string' ? v.referrer : '').trim();
  if (!authorizationCode || !referrer) return null;
  return { authorizationCode, referrer };
}

async function performLogin(): Promise<string> {
  const runtime = getHostRuntime();
  const raw = await requestAppsInTossLogin(runtime);
  const loginResult = readLoginResult(raw);
  if (!loginResult) throw new Error('invalid_login_result');

  const res = await fetch(`${API_BASE}/auth/apps-in-toss/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginResult),
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
