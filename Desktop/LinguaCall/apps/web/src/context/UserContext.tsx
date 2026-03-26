import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import i18n, { getCachedUiLanguage, setCachedUiLanguage, type UiLanguageCode } from '../i18n';
import {
  persistSupabaseSession,
  readStoredSupabaseSession,
  refreshSupabaseSession,
  signOutSupabase,
  startSupabasePhoneOtp,
  verifySupabasePhoneOtp,
  type StoredSupabaseSession
} from '../lib/supabaseAuth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type UserContextValue = {
  getToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  sessionChecked: boolean;
  refreshSession: () => Promise<void>;
  uiLanguage: UiLanguageCode;
  setUiLanguage: (lang: UiLanguageCode) => Promise<void>;
  clearIdentity: () => Promise<void>;
  startPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [uiLanguage, setUiLanguageState] = useState<UiLanguageCode>(getCachedUiLanguage);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [session, setSession] = useState<StoredSupabaseSession | null>(null);
  const getToken = useCallback(async () => session?.accessToken ?? readStoredSupabaseSession()?.accessToken ?? null, [session]);

  const syncAuthStateWithApi = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return res.ok;
  }, []);

  const refreshSession = useCallback(async () => {
    const existing = readStoredSupabaseSession();
    if (!existing?.refreshToken) {
      persistSupabaseSession(null);
      setSession(null);
      setIsAuthenticated(false);
      setSessionChecked(true);
      return;
    }

    try {
      const nextSession = await refreshSupabaseSession(existing.refreshToken);
      persistSupabaseSession(nextSession);
      setSession(nextSession);
      const synced = await syncAuthStateWithApi(nextSession.accessToken);
      setIsAuthenticated(synced);
      if (!synced) {
        persistSupabaseSession(null);
        setSession(null);
      }
    } catch {
      persistSupabaseSession(null);
      setSession(null);
      setIsAuthenticated(false);
    } finally {
      setSessionChecked(true);
    }
  }, [syncAuthStateWithApi]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setUiLanguage = useCallback(async (lang: UiLanguageCode) => {
    setUiLanguageState(lang);
    setCachedUiLanguage(lang);
    await i18n.changeLanguage(lang);

    try {
      const token = await getToken();
      await fetch(`${API_BASE}/users/me/ui-language`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ uiLanguage: lang })
      });
    } catch {
      // silent — localStorage already updated, DB sync is best-effort
    }
  }, [getToken]);

  const clearIdentity = useCallback(async () => {
    const activeToken = session?.accessToken ?? readStoredSupabaseSession()?.accessToken;
    try {
      if (activeToken) {
        await signOutSupabase(activeToken);
      }
    } catch {
      // best-effort logout
    }
    persistSupabaseSession(null);
    setSession(null);
    setIsAuthenticated(false);
    setSessionChecked(true);
    window.location.hash = '#/';
  }, [session]);

  const startPhoneOtp = useCallback(async (phone: string) => {
    await startSupabasePhoneOtp(phone);
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, code: string) => {
    const nextSession = await verifySupabasePhoneOtp(phone, code);
    persistSupabaseSession(nextSession);
    setSession(nextSession);
    const synced = await syncAuthStateWithApi(nextSession.accessToken);
    setIsAuthenticated(synced);
    setSessionChecked(true);
    if (!synced) {
      persistSupabaseSession(null);
      setSession(null);
      throw new Error('failed_to_sync_supabase_identity');
    }
  }, [syncAuthStateWithApi]);

  return (
    <UserContext.Provider value={{ getToken, isAuthenticated, sessionChecked, refreshSession, uiLanguage, setUiLanguage, clearIdentity, startPhoneOtp, verifyPhoneOtp }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
