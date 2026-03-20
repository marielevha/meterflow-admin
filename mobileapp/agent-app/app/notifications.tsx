import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import {
  isAgentAuthError,
  toAgentErrorMessage,
} from '@/lib/api/agent-client';
import {
  listAgentNotifications,
  type AgentTaskNotification,
} from '@/lib/api/agent-notifications';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

const NOTIFICATIONS_PAGE_SIZE = 20;

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { logout } = useAgentSession();
  const { unreadCount, isReady, markNotificationsRead } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [notifications, setNotifications] = useState<AgentTaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = useCallback(
    async ({
      activeRef = { current: true },
      cursor,
      append = false,
    }: {
      activeRef?: { current: boolean };
      cursor?: string | null;
      append?: boolean;
    } = {}) => {
      if (append) {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setLoading(true);
        setError(null);
        setLoadMoreError(null);
      }

      try {
        const result = await listAgentNotifications({
          limit: NOTIFICATIONS_PAGE_SIZE,
          cursor: cursor ?? undefined,
        });
        if (!activeRef.current) return;
        setNotifications((current) => {
          if (!append) {
            return result.notifications;
          }

          const seenIds = new Set(current.map((notification) => notification.id));
          const nextItems = result.notifications.filter(
            (notification) => !seenIds.has(notification.id)
          );
          return [...current, ...nextItems];
        });
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toAgentErrorMessage(
          loadError,
          t('notifications.unavailableTitle')
        );
        if (append) {
          setLoadMoreError(message);
        } else {
          setError(message);
        }
        if (isAgentAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          if (append) {
            setLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [logout, t]
  );

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadNotifications({ activeRef });

      return () => {
        activeRef.current = false;
      };
    }, [loadNotifications])
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
    } catch (markError) {
      setError(toAgentErrorMessage(markError, t('notifications.unavailableTitle')));
    } finally {
      setMarkingAllRead(false);
    }
  }

  if (!isReady && loading) {
    return (
      <RequireAgentAuth>
        <AppPage title={t('notifications.title')} topBarMode="back" backHref="/(tabs)">
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        </AppPage>
      </RequireAgentAuth>
    );
  }

  return (
    <RequireAgentAuth>
      <AppPage title={t('notifications.title')} topBarMode="back" backHref="/(tabs)">
        {!loading && !error && notifications.length > 0 && unreadCount > 0 ? (
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
                {t('common.markAllRead')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
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
                    pathname: '/missions/[id]',
                    params: {
                      id: notification.taskId,
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
                    notificationTone(notification.type, palette).iconWrap,
                  ]}>
                  <Ionicons
                    name={notificationTone(notification.type, palette).icon}
                    size={18}
                    color={notificationTone(notification.type, palette).iconColor}
                  />
                </View>

                <View style={styles.notificationBody}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: palette.headline }]} numberOfLines={2}>
                      {buildNotificationTitle(notification, t)}
                    </Text>
                    <Text style={[styles.notificationDate, { color: palette.muted }]}>
                      {formatDisplayDate(notification.createdAt, locale)}
                    </Text>
                  </View>

                  <Text style={[styles.notificationText, { color: palette.muted }]}>
                    {buildNotificationBody(notification, t)}
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
                          { color: notificationTone(notification.type, palette).textColor },
                        ]}>
                        {buildNotificationTag(notification, t)}
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
    </RequireAgentAuth>
  );
}

function buildNotificationTitle(
  notification: AgentTaskNotification,
  t: (key: string) => string
) {
  switch (notification.type) {
    case 'ASSIGNED':
      return t('notifications.assignmentTitle');
    case 'STARTED':
      return t('notifications.startedTitle');
    case 'BLOCKED':
      return t('notifications.blockedTitle');
    case 'COMPLETED':
      return t('notifications.completedTitle');
    case 'FIELD_RESULT_SUBMITTED':
      return t('notifications.fieldResultTitle');
    default:
      return t('notifications.title');
  }
}

function buildNotificationBody(
  notification: AgentTaskNotification,
  t: (key: string) => string
) {
  switch (notification.type) {
    case 'ASSIGNED':
      return `${notification.taskTitle} · ${notification.customerName}`;
    case 'STARTED':
      return t('notifications.startedBody').replace('{task}', notification.taskTitle);
    case 'BLOCKED':
      return t('notifications.blockedBody').replace('{task}', notification.taskTitle);
    case 'COMPLETED':
      return t('notifications.completedBody').replace('{task}', notification.taskTitle);
    case 'FIELD_RESULT_SUBMITTED':
      return t('notifications.fieldResultBody').replace('{task}', notification.taskTitle);
    default:
      return notification.taskTitle;
  }
}

function buildNotificationTag(
  notification: AgentTaskNotification,
  t: (key: string) => string
) {
  switch (notification.type) {
    case 'ASSIGNED':
      return t('notifications.tagAssigned');
    case 'STARTED':
      return t('missions.statusInProgress');
    case 'BLOCKED':
      return t('missions.statusBlocked');
    case 'COMPLETED':
      return t('missions.statusDone');
    case 'FIELD_RESULT_SUBMITTED':
      return t('notifications.tagField');
    default:
      return t('common.notifications');
  }
}

function notificationTone(
  type: AgentTaskNotification['type'],
  palette: (typeof Colors)['light']
) {
  switch (type) {
    case 'BLOCKED':
      return {
        icon: 'alert-circle-outline' as const,
        iconWrap: { backgroundColor: '#fff6e7' },
        iconColor: '#c77c11',
        textColor: '#c77c11',
      };
    case 'COMPLETED':
    case 'FIELD_RESULT_SUBMITTED':
      return {
        icon: 'checkmark-circle-outline' as const,
        iconWrap: { backgroundColor: '#edf9f0' },
        iconColor: palette.success,
        textColor: palette.success,
      };
    default:
      return {
        icon: 'briefcase-outline' as const,
        iconWrap: { backgroundColor: palette.accentSoft },
        iconColor: palette.accent,
        textColor: palette.accent,
      };
  }
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
  notificationCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    gap: 8,
  },
  notificationHeader: {
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  notificationDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  notificationText: {
    fontSize: 14,
    lineHeight: 21,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  notificationStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loadMoreSection: {
    gap: 10,
    alignItems: 'center',
    paddingBottom: 4,
  },
  loadMoreLoading: {
    paddingVertical: 8,
  },
  loadMoreButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
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
    fontWeight: '600',
    textAlign: 'center',
  },
});
