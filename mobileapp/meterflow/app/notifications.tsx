import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { AppStateCard } from '@/components/app/app-state-card';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import {
  listClientNotifications,
  type MobileNotification,
} from '@/lib/api/mobile-notifications';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

const NOTIFICATIONS_PAGE_SIZE = 20;

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { logout } = useMobileSession();
  const { unreadCount, markNotificationsRead } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const hasNotificationsData = notifications.length > 0;

  const loadNotifications = useCallback(
    async ({
      activeRef = { current: true },
      cursor,
      append = false,
      mode = 'initial',
    }: {
      activeRef?: { current: boolean };
      cursor?: string | null;
      append?: boolean;
      mode?: 'initial' | 'refresh' | 'background';
    } = {}) => {
      if (append) {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else if (mode === 'refresh') {
        setRefreshing(true);
        setError(null);
        setLoadMoreError(null);
      } else {
        if (mode === 'initial') {
          setLoading(true);
        }
        setError(null);
        setLoadMoreError(null);
      }

      try {
        const result = await listClientNotifications({
          limit: NOTIFICATIONS_PAGE_SIZE,
          cursor: cursor ?? undefined,
        });
        if (!activeRef.current) return;
        setNotifications((current) => {
          if (!append) {
            return result.notifications;
          }

          const seenIds = new Set(current.map((notification) => notification.id));
          const nextItems = result.notifications.filter((notification) => !seenIds.has(notification.id));
          return [...current, ...nextItems];
        });
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('notifications.unavailableTitle'));
        if (append) {
          setLoadMoreError(message);
        } else {
          setError(message);
        }
        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          if (append) {
            setLoadingMore(false);
          } else if (mode === 'refresh') {
            setRefreshing(false);
          } else {
            if (mode === 'initial') {
              setLoading(false);
            }
          }
        }
      }
    },
    [logout, t]
  );

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadNotifications({
        activeRef,
        mode: hasNotificationsData ? 'background' : 'initial',
      });

      return () => {
        activeRef.current = false;
      };
    }, [hasNotificationsData, loadNotifications])
  );

  async function handleLoadMore() {
    if (loading || loadingMore || !hasMore || !nextCursor) {
      return;
    }

    await loadNotifications({ cursor: nextCursor, append: true });
  }

  async function handleMarkAllRead() {
    if (notifications.length === 0 || markingAllRead) {
      return;
    }

    setMarkingAllRead(true);

    try {
      await markNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        }))
      );
    } catch (error) {
      setError(toMobileErrorMessage(error, t('notifications.unavailableTitle')));
    } finally {
      setMarkingAllRead(false);
    }
  }

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('common.notifications')}
        subtitle={t('notifications.subtitle')}
        topBarMode="back"
        backHref="/(tabs)"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadNotifications({ mode: 'refresh' })}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
        {!loading && notifications.length > 0 && unreadCount > 0 ? (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => void handleMarkAllRead()}
              disabled={markingAllRead}
              style={[
                styles.markAllButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  opacity: markingAllRead ? 0.6 : 1,
                },
              ]}>
              <Ionicons
                name={markingAllRead ? 'hourglass-outline' : 'checkmark-done-outline'}
                size={16}
                color={palette.accent}
              />
              <Text style={[styles.markAllButtonText, { color: palette.primary }]}>
                {t('notifications.markAllRead')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !hasNotificationsData ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error && !hasNotificationsData ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('notifications.unavailableTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadNotifications()}
          />
        ) : notifications.length === 0 ? (
          <AppStateCard
            palette={palette}
            icon="notifications-off-outline"
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptyDescription')}
          />
        ) : (
          <View style={styles.stack}>
            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() =>
                  safePush({
                    pathname: '/readings/[id]',
                    params: {
                      id: notification.readingId,
                      notificationId: notification.id,
                    },
                  })
                }
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: notification.isRead ? palette.surface : palette.surfaceMuted,
                    borderColor: notification.isRead ? palette.border : `${palette.accent}33`,
                  },
                ]}>
                <View
                  style={[
                    styles.notificationIconWrap,
                    notificationTone(notification.status, palette).iconWrap,
                  ]}>
                  <Ionicons
                    name={notificationTone(notification.status, palette).icon}
                    size={18}
                    color={notificationTone(notification.status, palette).iconColor}
                  />
                </View>

                <View style={styles.notificationBody}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: palette.headline }]} numberOfLines={2}>
                      {notification.title}
                    </Text>
                    <Text style={[styles.notificationDate, { color: palette.muted }]}>
                      {formatDisplayDate(notification.createdAt, locale)}
                    </Text>
                  </View>

                  <Text style={[styles.notificationText, { color: palette.muted }]}>
                    {notification.body}
                  </Text>

                  <View style={styles.notificationFooter}>
                    <Text style={[styles.meterText, { color: palette.headline }]}>
                      {notification.meterSerialNumber}
                    </Text>

                    <View style={styles.notificationStatusGroup}>
                      {!notification.isRead ? (
                        <View style={[styles.unreadDot, { backgroundColor: palette.accent }]} />
                      ) : null}
                      <Text
                        style={[
                          styles.statusText,
                          { color: notificationTone(notification.status, palette).textColor },
                        ]}>
                        {notification.statusLabel || '--'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}

            {hasMore ? (
              <View style={styles.loadMoreSection}>
                {loadingMore ? (
                  <View style={styles.loadMoreLoading}>
                    <CircularLoading palette={palette} size={40} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void handleLoadMore()}
                    style={[
                      styles.loadMoreButton,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}>
                    <Text style={[styles.loadMoreButtonText, { color: palette.primary }]}>
                      {t('notifications.loadMore')}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={palette.accent} />
                  </Pressable>
                )}

                {loadMoreError ? (
                  <Text style={[styles.loadMoreErrorText, { color: palette.danger }]}>
                    {loadMoreError}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function notificationTone(status: string, palette: (typeof Colors)['light']) {
  if (status === 'REJECTED') {
    return {
      icon: 'close-circle-outline' as const,
      iconWrap: { backgroundColor: '#fff0ef' },
      iconColor: palette.danger,
      textColor: palette.danger,
    };
  }

  if (status === 'FLAGGED' || status === 'RESUBMISSION_REQUESTED') {
    return {
      icon: 'alert-circle-outline' as const,
      iconWrap: { backgroundColor: '#fff6e7' },
      iconColor: '#c77c11',
      textColor: '#c77c11',
    };
  }

  return {
    icon: 'checkmark-circle-outline' as const,
    iconWrap: { backgroundColor: palette.accentSoft },
    iconColor: palette.accent,
    textColor: palette.accent,
  };
}

function formatDisplayDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: 'flex-end',
  },
  markAllButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  loadingWrap: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: 12,
  },
  loadMoreSection: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  loadMoreLoading: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  loadMoreErrorText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  notificationCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    gap: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    lineHeight: 18,
  },
  notificationText: {
    fontSize: 13,
    lineHeight: 19,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  meterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  notificationStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
