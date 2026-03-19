import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listClientNotifications, type MobileNotification } from '@/lib/api/mobile-notifications';
import { humanizeReadingStatus } from '@/lib/readings/review-reasons';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function NotificationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { logout } = useMobileSession();
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      setError(null);

      try {
        const result = await listClientNotifications();
        if (!active) return;
        setNotifications(result.notifications);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : 'Impossible de charger les notifications.';
        setError(message);
        if (message.includes('Session invalide')) {
          await logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, [logout]);

  return (
    <RequireMobileAuth>
      <AppPage title="Notifications" subtitle="Mises à jour de vos relevés" topBarMode="back" backHref="/(tabs)">
        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Ionicons name="notifications-off-outline" size={22} color={palette.icon} />
            </View>
            <Text style={[styles.stateTitle, { color: palette.headline }]}>Aucune notification pour le moment</Text>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              Les décisions sur vos relevés apparaîtront ici avec des messages plus clairs.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                onPress={() => router.push(`/readings/${notification.readingId}`)}
                style={[styles.notificationCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
                      {formatDisplayDate(notification.createdAt)}
                    </Text>
                  </View>

                  <Text style={[styles.notificationText, { color: palette.muted }]}>{notification.body}</Text>

                  <View style={styles.notificationFooter}>
                    <Text style={[styles.meterText, { color: palette.headline }]}>
                      {notification.meterSerialNumber}
                    </Text>
                    <Text style={[styles.statusText, { color: notificationTone(notification.status, palette).textColor }]}>
                      {humanizeReadingStatus(notification.status)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
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

  if (status === 'FLAGGED') {
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

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
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
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
