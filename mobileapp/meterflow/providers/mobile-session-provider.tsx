import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { loginWithBackend, type MobileLoginResponse } from '@/lib/auth/mobile-auth-api';
import { unregisterStoredMobilePushToken } from '@/lib/api/mobile-push';
import {
  clearCurrentMobileSession,
  hydrateMobileSessionStore,
  setCurrentMobileSession,
  subscribeToMobileSession,
  updateCurrentMobileSessionUser,
  type MobileSession,
  type MobileAuthUser,
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
  updateSessionUser: (nextUser: Partial<MobileAuthUser>) => Promise<void>;
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

  const login = useCallback(async (params: LoginParams) => {
    setIsLoading(true);
    try {
      const result = await loginWithBackend(params);
      await setCurrentMobileSession(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterStoredMobilePushToken();
    } catch {
      // best effort cleanup
    }
    await clearCurrentMobileSession();
  }, []);

  const updateSessionUser = useCallback(async (nextUser: Partial<MobileAuthUser>) => {
    await updateCurrentMobileSessionUser(nextUser);
  }, []);

  const value = useMemo<MobileSessionContextValue>(
    () => ({
      session,
      isAuthenticated: !!session,
      isLoading,
      isReady,
      login,
      logout,
      updateSessionUser,
    }),
    [session, isLoading, isReady, login, logout, updateSessionUser]
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
