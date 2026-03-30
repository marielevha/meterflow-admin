import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';

import { useSafePush } from '@/hooks/use-safe-push';
import { markClientNotificationsRead } from '@/lib/api/mobile-notifications';
import {
  getMobileAppVersion,
  registerMobilePushToken,
  requestExpoPushToken,
} from '@/lib/api/mobile-push';
import { readStoredPushToken } from '@/lib/storage/push-token';
import { useMobileSession } from '@/providers/mobile-session-provider';

type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';

type MobilePushDiagnostics = {
  permissionStatus: PushPermissionStatus;
  platform: string;
  appVersion: string | null;
  tokenPreview: string | null;
  backendRegistered: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
};

type MobilePushContextValue = {
  diagnostics: MobilePushDiagnostics;
  isCheckingPush: boolean;
  refreshPushDiagnostics: (options?: { forceRegister?: boolean }) => Promise<void>;
};

const DEFAULT_DIAGNOSTICS: MobilePushDiagnostics = {
  permissionStatus: 'unknown',
  platform: Platform.OS,
  appVersion: getMobileAppVersion(),
  tokenPreview: null,
  backendRegistered: false,
  lastCheckedAt: null,
  lastError: null,
};

const MobilePushContext = createContext<MobilePushContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function normalizePermissionStatus(status?: string | null): PushPermissionStatus {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status;
  }

  return 'unknown';
}

function previewPushToken(token: string | null) {
  if (!token) return null;
  return token.length > 26 ? `${token.slice(0, 18)}...${token.slice(-6)}` : token;
}

export function MobilePushProvider({ children }: PropsWithChildren) {
  const { session, isReady } = useMobileSession();
  const { safePush } = useSafePush();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const registeredAccessTokenRef = useRef<string | null>(null);
  const activeRef = useRef(true);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const [diagnostics, setDiagnostics] = useState<MobilePushDiagnostics>(DEFAULT_DIAGNOSTICS);
  const [isCheckingPush, setIsCheckingPush] = useState(false);

  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      void (async () => {
        const notificationId = response.notification.request.content.data?.notificationId;
        const actionPath = response.notification.request.content.data?.actionPath;
        const readingId = response.notification.request.content.data?.readingId;

        if (typeof notificationId === 'string' && notificationId) {
          try {
            await markClientNotificationsRead([notificationId]);
          } catch {
            // best effort only
          }
        }

        if (typeof actionPath === 'string' && actionPath) {
          safePush(actionPath as Href);
          return;
        }

        if (typeof readingId === 'string' && readingId) {
          safePush(`/readings/${readingId}`);
          return;
        }

        safePush('/notifications');
      })();
    });

    return () => {
      notificationResponseListener.current?.remove();
      notificationResponseListener.current = null;
    };
  }, [safePush]);

  const refreshPushDiagnostics = useCallback(
    async (options: { forceRegister?: boolean } = {}) => {
      if (syncPromiseRef.current) {
        return syncPromiseRef.current;
      }

      const run = async () => {
        const forceRegister = options.forceRegister ?? false;

        if (activeRef.current) {
          setIsCheckingPush(true);
        }

        try {
          const currentPermission = await Notifications.getPermissionsAsync();
          const storedToken = await readStoredPushToken();
          const checkedAt = new Date().toISOString();
          const baseDiagnostics: MobilePushDiagnostics = {
            permissionStatus: normalizePermissionStatus(currentPermission.status),
            platform: Platform.OS,
            appVersion: getMobileAppVersion(),
            tokenPreview: previewPushToken(storedToken),
            backendRegistered: !!storedToken,
            lastCheckedAt: checkedAt,
            lastError: null,
          };

          if (activeRef.current) {
            setDiagnostics((previous) => ({
              ...previous,
              ...baseDiagnostics,
            }));
          }

          if (!isReady || !session?.accessToken) {
            return;
          }

          if (!forceRegister) {
            return;
          }

          const result = await requestExpoPushToken();
          if (!result.granted || !result.token) {
            if (activeRef.current) {
              setDiagnostics((previous) => ({
                ...previous,
                permissionStatus: normalizePermissionStatus(result.status),
                lastCheckedAt: checkedAt,
              }));
            }
            return;
          }

          await registerMobilePushToken({
            expoPushToken: result.token,
            platform: Platform.OS,
            appVersion: getMobileAppVersion(),
          });

          if (!activeRef.current) {
            return;
          }

          registeredAccessTokenRef.current = session.accessToken;
          setDiagnostics({
            permissionStatus: 'granted',
            platform: Platform.OS,
            appVersion: getMobileAppVersion(),
            tokenPreview: previewPushToken(result.token),
            backendRegistered: true,
            lastCheckedAt: checkedAt,
            lastError: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown_error';
          console.warn('[mobile-push] register_failed', message);

          if (activeRef.current) {
            setDiagnostics((previous) => ({
              ...previous,
              lastCheckedAt: new Date().toISOString(),
              lastError: message,
            }));
          }
        } finally {
          if (activeRef.current) {
            setIsCheckingPush(false);
          }
        }
      };

      syncPromiseRef.current = run().finally(() => {
        syncPromiseRef.current = null;
      });

      return syncPromiseRef.current;
    },
    [isReady, session?.accessToken]
  );

  useEffect(() => {
    if (!isReady || !session?.accessToken) {
      registeredAccessTokenRef.current = null;
      void refreshPushDiagnostics();
      return;
    }

    if (registeredAccessTokenRef.current === session.accessToken) {
      return;
    }

    void refreshPushDiagnostics({ forceRegister: true });
  }, [isReady, refreshPushDiagnostics, session?.accessToken]);

  const value = useMemo<MobilePushContextValue>(
    () => ({
      diagnostics,
      isCheckingPush,
      refreshPushDiagnostics,
    }),
    [diagnostics, isCheckingPush, refreshPushDiagnostics]
  );

  return <MobilePushContext.Provider value={value}>{children}</MobilePushContext.Provider>;
}

export function useMobilePushDiagnostics() {
  const context = useContext(MobilePushContext);

  if (!context) {
    throw new Error('useMobilePushDiagnostics must be used within MobilePushProvider');
  }

  return context;
}
