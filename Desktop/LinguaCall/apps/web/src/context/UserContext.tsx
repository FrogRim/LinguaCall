import React, { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'lingua-call-clerk-id';

type UserContextValue = {
  clerkUserId: string;
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

  const clearIdentity = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  return (
    <UserContext.Provider value={{ clerkUserId, clearIdentity }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
