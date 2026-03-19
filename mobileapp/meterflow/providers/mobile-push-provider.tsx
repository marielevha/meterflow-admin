import { PropsWithChildren, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  getMobileAppVersion,
  registerMobilePushToken,
  requestExpoPushToken,
} from '@/lib/api/mobile-push';
import { useMobileSession } from '@/providers/mobile-session-provider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function MobilePushProvider({ children }: PropsWithChildren) {
  const { session, isReady } = useMobileSession();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const registeredAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const readingId = response.notification.request.content.data?.readingId;
      if (typeof readingId === 'string' && readingId) {
        router.push(`/readings/${readingId}`);
        return;
      }

      router.push('/notifications');
    });

    return () => {
      notificationResponseListener.current?.remove();
      notificationResponseListener.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !session?.accessToken) {
      registeredAccessTokenRef.current = null;
      return;
    }

    if (registeredAccessTokenRef.current === session.accessToken) {
      return;
    }

    let cancelled = false;

    async function registerToken() {
      try {
        const result = await requestExpoPushToken();
        if (cancelled || !result.granted || !result.token) return;

        await registerMobilePushToken({
          expoPushToken: result.token,
          platform: Platform.OS,
          appVersion: getMobileAppVersion(),
        });

        if (!cancelled) {
          registeredAccessTokenRef.current = session.accessToken;
        }
      } catch (error) {
        console.warn(
          '[mobile-push] register_failed',
          error instanceof Error ? error.message : 'unknown_error'
        );
        // Best effort: the app keeps working even if push registration fails.
      }
    }

    void registerToken();

    return () => {
      cancelled = true;
    };
  }, [isReady, session?.accessToken]);

  return children;
}
