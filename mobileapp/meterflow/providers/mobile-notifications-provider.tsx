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
  isMobileAuthError,
  toMobileErrorMessage,
} from '@/lib/api/mobile-client';
import {
  listClientNotifications,
  markClientNotificationsRead,
} from '@/lib/api/mobile-notifications';
import { useMobileSession } from '@/providers/mobile-session-provider';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

type MobileNotificationsContextValue = {
  unreadCount: number;
  loadingUnread: boolean;
  refreshUnreadCount: () => Promise<void>;
  markNotificationsRead: (notificationIds?: string[]) => Promise<void>;
};

const MobileNotificationsContext = createContext<MobileNotificationsContextValue | undefined>(
  undefined
);

export function MobileNotificationsProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { session, logout } = useMobileSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingUnread, setLoadingUnread] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!session?.accessToken) {
      setUnreadCount(0);
      return;
    }

    setLoadingUnread(true);

    try {
      const result = await listClientNotifications({ limit: 1 });
      setUnreadCount(result.unreadCount);
    } catch (error) {
      if (isMobileAuthError(error)) {
        await logout();
      }
      console.log('[mobile-notifications] unread_refresh_failed', {
        message: toMobileErrorMessage(error, 'unknown_error'),
      });
    } finally {
      setLoadingUnread(false);
    }
  }, [logout, session?.accessToken]);

  const markNotificationsRead = useCallback(
    async (notificationIds?: string[]) => {
      if (!session?.accessToken) {
        setUnreadCount(0);
        return;
      }

      try {
        const result = await markClientNotificationsRead(notificationIds);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        if (isMobileAuthError(error)) {
          await logout();
        }
        console.log('[mobile-notifications] mark_read_failed', {
          message: toMobileErrorMessage(error, 'unknown_error'),
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
      refreshUnreadCount,
      markNotificationsRead,
    }),
    [loadingUnread, markNotificationsRead, refreshUnreadCount, unreadCount]
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
