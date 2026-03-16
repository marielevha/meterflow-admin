import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { loginWithBackend, type MobileLoginResponse } from '@/lib/auth/mobile-auth-api';
import {
  clearCurrentMobileSession,
  hydrateMobileSessionStore,
  setCurrentMobileSession,
  subscribeToMobileSession,
  type MobileSession,
} from '@/lib/auth/mobile-session-store';

type LoginParams = {
  identifier: string;
  password: string;
};

type MobileSessionContextValue = {
  session: MobileSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  login: (params: LoginParams) => Promise<MobileLoginResponse>;
  logout: () => Promise<void>;
};

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

export function MobileSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMobileSession(setSession);

    void hydrateMobileSessionStore().finally(() => {
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  async function login(params: LoginParams) {
    setIsLoading(true);
    try {
      const result = await loginWithBackend(params);
      await setCurrentMobileSession(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await clearCurrentMobileSession();
  }

  const value = useMemo<MobileSessionContextValue>(
    () => ({
      session,
      isAuthenticated: !!session,
      isLoading,
      isReady,
      login,
      logout,
    }),
    [session, isLoading, isReady]
  );

  return <MobileSessionContext.Provider value={value}>{children}</MobileSessionContext.Provider>;
}

export function useMobileSession() {
  const context = useContext(MobileSessionContext);

  if (!context) {
    throw new Error('useMobileSession must be used within MobileSessionProvider');
  }

  return context;
}
