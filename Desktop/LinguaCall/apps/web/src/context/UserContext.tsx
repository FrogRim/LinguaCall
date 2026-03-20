import React, { createContext, useContext, useState, useCallback } from 'react';
import i18n, { getCachedUiLanguage, setCachedUiLanguage, type UiLanguageCode } from '../i18n';

const STORAGE_KEY = 'lingua-call-clerk-id';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type UserContextValue = {
  clerkUserId: string;
  uiLanguage: UiLanguageCode;
  setUiLanguage: (lang: UiLanguageCode) => Promise<void>;
  clearIdentity: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [clerkUserId] = useState<string>(() => {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = `dev-${Math.random().toString(16).slice(2, 10)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  });

  const [uiLanguage, setUiLanguageState] = useState<UiLanguageCode>(getCachedUiLanguage);

  const setUiLanguage = useCallback(async (lang: UiLanguageCode) => {
    setUiLanguageState(lang);
    setCachedUiLanguage(lang);
    await i18n.changeLanguage(lang);

    try {
      await fetch(`${API_BASE}/users/me/ui-language`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': clerkUserId,
        },
        body: JSON.stringify({ uiLanguage: lang }),
      });
    } catch {
      // silent — localStorage already updated, DB sync is best-effort
    }
  }, [clerkUserId]);

  const clearIdentity = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  return (
    <UserContext.Provider value={{ clerkUserId, uiLanguage, setUiLanguage, clearIdentity }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
