import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { listClientMeters, type MobileMeter } from '@/lib/api/mobile-meters';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function MetersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { session, logout } = useMobileSession();
  const { safePush } = useSafePush();
  const [meters, setMeters] = useState<MobileMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMetersData = meters.length > 0;

  const loadMeters = useCallback(async (
      activeRef: { current: boolean } = { current: true },
      options: { mode?: 'initial' | 'refresh' | 'background' } = {}
    ) => {
      if (!session?.accessToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const mode = options.mode ?? 'initial';

      if (mode === 'refresh') {
        setRefreshing(true);
      } else if (mode === 'initial') {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await listClientMeters(session.accessToken);
        if (!activeRef.current) return;
        setMeters(result.meters);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('meters.unavailableFallback'));
        setError(message);

        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          if (mode === 'refresh') {
            setRefreshing(false);
          } else if (mode === 'initial') {
            setLoading(false);
          }
        }
      }
    }, [logout, session?.accessToken, t]);

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadMeters(activeRef, { mode: hasMetersData ? 'background' : 'initial' });

      return () => {
        activeRef.current = false;
      };
    }, [hasMetersData, loadMeters])
  );

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('common.meters')}
        subtitle={t('meters.subtitle')}
        topBarMode="back"
        backHref="/(tabs)"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMeters({ current: true }, { mode: 'refresh' })}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
        {loading && !hasMetersData ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error && !hasMetersData ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('meters.unavailableTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadMeters()}
          />
        ) : meters.length === 0 ? (
          <AppStateCard
            palette={palette}
            icon="flash-outline"
            title={t('meters.emptyTitle')}
            description={t('meters.emptyDescription')}
          />
        ) : (
          <View style={styles.stack}>
            {meters.map((meter) => {
              const latestState = meter.states[0];

              return (
                <Pressable
                  key={meter.id}
                  onPress={() => safePush(`/meters/${meter.id}`)}
                  style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.row}>
                    <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
                      <Ionicons name="flash-outline" size={18} color={palette.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: palette.headline }]}>{meter.serialNumber}</Text>
                      <Text style={[styles.meta, { color: palette.muted }]}>
                        {[meter.city, meter.zone].filter(Boolean).join(' / ') || t('meters.locationMissing')} • {meter.type}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.status, { color: palette.primary }]}>{meter.status}</Text>
                      <Ionicons name="chevron-forward" size={18} color={palette.icon} />
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricBlock}>
                      <Text style={[styles.metricLabel, { color: palette.muted }]}>{t('meters.lastIndex')}</Text>
                      <Text style={[styles.metricValue, { color: palette.headline }]}>
                        {latestState?.currentPrimary ?? '--'}
                      </Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={[styles.metricLabel, { color: palette.muted }]}>{t('meters.date')}</Text>
                      <Text style={[styles.metricValue, { color: palette.headline }]}>
                        {latestState?.effectiveAt
                          ? formatDisplayDate(latestState.effectiveAt, locale)
                          : '--'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function formatDisplayDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  iconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  meta: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  status: { fontSize: 12, fontWeight: '800' },
  metricsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  metricBlock: {
    flex: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
