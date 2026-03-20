import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  isAgentAuthError,
  toAgentErrorMessage,
} from '@/lib/api/agent-client';
import {
  listAgentNotifications,
  markAgentNotificationsRead,
} from '@/lib/api/agent-notifications';
import { useAgentSession } from '@/providers/agent-session-provider';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

type MobileNotificationsContextValue = {
  unreadCount: number;
  loadingUnread: boolean;
  isReady: boolean;
  refreshUnreadCount: () => Promise<void>;
  markNotificationsRead: (notificationIds?: string[]) => Promise<void>;
};

const MobileNotificationsContext = createContext<MobileNotificationsContextValue | undefined>(
  undefined
);

export function MobileNotificationsProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { session, logout } = useAgentSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!session?.accessToken) {
      setUnreadCount(0);
      setIsReady(true);
      return;
    }

    setLoadingUnread(true);

    try {
      const result = await listAgentNotifications({ limit: 1 });
      setUnreadCount(result.unreadCount);
    } catch (error) {
      if (isAgentAuthError(error)) {
        await logout();
      }
      console.log('[agent-notifications] unread_refresh_failed', {
        message: toAgentErrorMessage(error, 'unknown_error'),
      });
    } finally {
      setLoadingUnread(false);
      setIsReady(true);
    }
  }, [logout, session?.accessToken]);

  const markNotificationsRead = useCallback(
    async (notificationIds?: string[]) => {
      if (!session?.accessToken) {
        setUnreadCount(0);
        return;
      }

      try {
        const result = await markAgentNotificationsRead(notificationIds);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        if (isAgentAuthError(error)) {
          await logout();
        }
        console.log('[agent-notifications] mark_read_failed', {
          message: toAgentErrorMessage(error, 'unknown_error'),
        });
      }
    },
    [logout, session?.accessToken]
  );

  useEffect(() => {
    void refreshUnreadCount();
  }, [pathname, refreshUnreadCount]);

  useEffect(() => {
    if (!session?.accessToken) {
      setUnreadCount(0);
      return;
    }

    const intervalId = setInterval(() => {
      void refreshUnreadCount();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [refreshUnreadCount, session?.accessToken]);

  const value = useMemo(
    () => ({
      unreadCount,
      loadingUnread,
      isReady,
      refreshUnreadCount,
      markNotificationsRead,
    }),
    [isReady, loadingUnread, markNotificationsRead, refreshUnreadCount, unreadCount]
  );

  return (
    <MobileNotificationsContext.Provider value={value}>
      {children}
    </MobileNotificationsContext.Provider>
  );
}

export function useMobileNotifications() {
  const context = useContext(MobileNotificationsContext);
  if (!context) {
    throw new Error('useMobileNotifications must be used within MobileNotificationsProvider');
  }

  return context;
}
