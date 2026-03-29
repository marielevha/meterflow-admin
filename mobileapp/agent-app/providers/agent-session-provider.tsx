import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { loginWithBackend, type AgentLoginResponse } from '@/lib/auth/agent-auth-api';
import { unregisterStoredAgentPushToken } from '@/lib/api/agent-push';
import {
  clearCurrentAgentSession,
  hydrateAgentSessionStore,
  setCurrentAgentSession,
  subscribeToAgentSession,
  updateCurrentAgentSessionUser,
  type AgentAuthUser,
  type AgentSession,
} from '@/lib/auth/agent-session-store';

type LoginParams = {
  identifier: string;
  password: string;
};

type AgentSessionContextValue = {
  session: AgentSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  login: (params: LoginParams) => Promise<AgentLoginResponse>;
  logout: () => Promise<void>;
  updateSessionUser: (nextUser: Partial<AgentAuthUser>) => Promise<void>;
};

const AgentSessionContext = createContext<AgentSessionContextValue | null>(null);

export function AgentSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAgentSession(setSession);

    void hydrateAgentSessionStore().finally(() => {
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (params: LoginParams) => {
    setIsLoading(true);
    try {
      const result = await loginWithBackend(params);
      await setCurrentAgentSession(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterStoredAgentPushToken();
    } catch {
      // best effort cleanup
    }
    await clearCurrentAgentSession();
  }, []);

  const updateSessionUser = useCallback(async (nextUser: Partial<AgentAuthUser>) => {
    await updateCurrentAgentSessionUser(nextUser);
  }, []);

  const value = useMemo<AgentSessionContextValue>(
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

  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

export function useAgentSession() {
  const context = useContext(AgentSessionContext);

  if (!context) {
    throw new Error('useAgentSession must be used within AgentSessionProvider');
  }

  return context;
}
