import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMeters() {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await listClientMeters(session.accessToken);
        if (!active) return;
        setMeters(result.meters);
      } catch (loadError) {
        if (!active) return;
        const message = toMobileErrorMessage(loadError, t('meters.unavailableFallback'));
        setError(message);

        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMeters();

    return () => {
      active = false;
    };
  }, [logout, session?.accessToken, t]);

  return (
    <RequireMobileAuth>
      <AppPage title={t('common.meters')} subtitle={t('meters.subtitle')} topBarMode="back" backHref="/(tabs)">
        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : meters.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.muted }]}>{t('meters.emptyDescription')}</Text>
          </View>
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
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 10,
    alignItems: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
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
