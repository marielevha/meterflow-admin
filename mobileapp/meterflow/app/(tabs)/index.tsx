import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { listClientConsumption, type MobileConsumptionEntry } from '@/lib/api/mobile-consumption';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listClientMeters, type MobileMeter } from '@/lib/api/mobile-meters';
import { useMobileSession } from '@/providers/mobile-session-provider';

type DashboardData = {
  meters: MobileMeter[];
  consumptions: MobileConsumptionEntry[];
};

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();
  const { session, logout } = useMobileSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    meters: [],
    consumptions: [],
  });
  const [activeMeterIndex, setActiveMeterIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [metersResult, consumptionsResult] = await Promise.all([
          listClientMeters(session.accessToken),
          listClientConsumption({ limit: 12 }),
        ]);

        if (!active) return;
        setDashboardData({
          meters: metersResult.meters,
          consumptions: consumptionsResult.consumptions,
        });
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Impossible de charger votre tableau de bord.';
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

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [logout, session?.accessToken]);

  useEffect(() => {
    if (dashboardData.meters.length === 0) {
      setActiveMeterIndex(0);
      return;
    }

    setActiveMeterIndex((current) => Math.min(current, dashboardData.meters.length - 1));
  }, [dashboardData.meters.length]);

  const activeMeter = dashboardData.meters[activeMeterIndex] ?? null;

  const latestConsumptions = useMemo(() => {
    const meterScopedConsumptions = activeMeter
      ? dashboardData.consumptions.filter((consumption) => consumption.meterId === activeMeter.id)
      : dashboardData.consumptions;

    return meterScopedConsumptions.slice(0, 5);
  }, [activeMeter, dashboardData.consumptions]);
  const meterCardWidth = Math.min(screenWidth - 56, 320);
  const meterSnapInterval = meterCardWidth + 12;

  return (
    <RequireMobileAuth>
      <AppPage title="Accueil" subtitle="Vue d’ensemble">
        {/* <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>Bonjour</Text>
            <Text style={[styles.title, { color: palette.headline }]}>{customerName}</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Suivez vos derniers relevés et lancez une nouvelle soumission rapidement.
            </Text>
          </View>

          <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.avatarText, { color: palette.primary }]}>
              {session?.user.firstName?.[0] || session?.user.username?.[0] || 'C'}
            </Text>
          </View>
        </View> */}

        <View style={styles.section}>
          {loading ? (
            <View style={styles.readingsLoadingWrap}>
              <CircularLoading palette={palette} />
            </View>
          ) : error ? (
            <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
              <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
            </View>
          ) : dashboardData.meters.length === 0 ? (
            <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Ionicons name="flash-outline" size={20} color={palette.icon} />
              <Text style={[styles.stateText, { color: palette.muted }]}>
                Aucun compteur associé à ce compte.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                pagingEnabled={false}
                decelerationRate="fast"
                snapToInterval={meterSnapInterval}
                snapToAlignment="start"
                disableIntervalMomentum
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.meterDeckContent}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(offsetX / meterSnapInterval);
                  setActiveMeterIndex(Math.max(0, Math.min(nextIndex, dashboardData.meters.length - 1)));
                }}>
                {dashboardData.meters.map((meter) => {
                  const latestState = meter.states[0];
                  return (
                    <Pressable
                      key={meter.id}
                      onPress={() => router.push(`/meters/${meter.id}`)}
                      style={[
                        styles.financeCard,
                        {
                          width: meterCardWidth,
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}>
                      <View style={styles.financeCardTop}>
                        <View style={styles.financeCardTitleBlock}>
                          <Text style={[styles.financeCardLabel, { color: palette.muted }]}>Compteur</Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.financeCardTitle, { color: palette.headline }]}>
                            {meter.serialNumber}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.financeStatusPill,
                            { backgroundColor: `${palette.accent}1f` },
                          ]}>
                          <Text style={[styles.financeStatusText, { color: palette.accent }]}>
                            {humanizeMeterStatus(meter.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.financeBottomRow}>
                        <View style={styles.financeMetric}>
                          <Text style={[styles.financeMetricLabel, { color: palette.muted }]}>
                            Index principal
                          </Text>
                          <Text style={[styles.financeMetricValue, { color: palette.headline }]}>
                            {latestState?.currentPrimary?.toString() || '--'}
                          </Text>
                        </View>
                        {meter.type === 'DUAL_INDEX' ? (
                          <View style={styles.financeMetric}>
                            <Text style={[styles.financeMetricLabel, { color: palette.muted }]}>
                              Index secondaire
                            </Text>
                            <Text style={[styles.financeMetricValue, { color: palette.headline }]}>
                              {latestState?.currentSecondary?.toString() || '--'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {dashboardData.meters.length > 1 ? (
                <View style={styles.carouselDots}>
                  {dashboardData.meters.map((meter, index) => {
                    const active = index === activeMeterIndex;
                    return (
                      <View
                        key={meter.id}
                        style={[
                          styles.carouselDot,
                          {
                            backgroundColor: active ? palette.accent : palette.border,
                            width: active ? 20 : 8,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              numberOfLines={2}
              style={[styles.sectionTitle, { color: palette.headline }]}>
              Dernières consommations
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/account')}>
              <Text style={[styles.sectionLink, { color: palette.accent }]}>Voir tout</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.readingsLoadingWrap}>
              <CircularLoading palette={palette} />
            </View>
          ) : error ? (
            <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
              <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
            </View>
          ) : latestConsumptions.length === 0 ? (
            <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Ionicons name="stats-chart-outline" size={20} color={palette.icon} />
              <Text style={[styles.stateText, { color: palette.muted }]}>
                Aucune consommation calculée pour le moment.
              </Text>
            </View>
          ) : (
            <View style={styles.readingsList}>
              {latestConsumptions.map((consumption) => (
                <Pressable
                  key={`${consumption.meterId}-${consumption.periodKey}`}
                  onPress={() =>
                    router.push({
                      pathname: '/consumption/[meterId]',
                      params: { meterId: consumption.meterId, periodKey: consumption.periodKey },
                    })
                  }
                  style={({ pressed }) => [
                    styles.readingWalletRow,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}>
                  <View
                    style={[
                      styles.readingIconWrap,
                      { backgroundColor: palette.surfaceMuted, borderColor: `${palette.border}80` },
                    ]}>
                    <Ionicons name="stats-chart-outline" size={18} color={palette.accent} />
                  </View>

                  <View style={styles.readingTransactionBody}>
                    <View style={styles.readingTextBlock}>
                      <Text numberOfLines={1} style={[styles.readingTitle, { color: palette.headline }]}>
                        {consumption.periodLabel}
                      </Text>
                      <Text style={[styles.readingMeta, { color: palette.muted }]} numberOfLines={1}>
                        {consumption.meterSerialNumber}
                      </Text>
                    </View>

                    <View style={styles.readingAmountBlock}>
                      <Text style={[styles.readingAmountValue, { color: palette.headline }]}>
                        {formatConsumption(consumption.totalConsumption)}
                      </Text>
                      <Text style={[styles.readingAmountMeta, { color: palette.muted }]}>consommation</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </AppPage>
    </RequireMobileAuth>
  );
}

function formatConsumption(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(0)} kWh`;
}

function humanizeMeterStatus(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Actif';
    case 'INACTIVE':
      return 'Inactif';
    case 'MAINTENANCE':
      return 'Maintenance';
    case 'REPLACED':
      return 'Remplacé';
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerTextBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  sectionLink: {
    flexShrink: 0,
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  meterDeckContent: {
    gap: 12,
    paddingHorizontal: 4,
  },
  financeCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 20,
  },
  financeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  financeCardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  financeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  financeCardTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  financeStatusPill: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  financeStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  financeBottomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  financeMetric: {
    flex: 1,
    gap: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  financeMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  financeMetricValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  carouselDot: {
    height: 8,
    borderRadius: 999,
  },
  readingsList: {
    gap: 10,
  },
  readingsLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  readingWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  readingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingTransactionBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readingTextBlock: {
    flex: 1,
    gap: 2,
  },
  readingTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  readingMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  readingAmountBlock: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 88,
  },
  readingAmountValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  readingAmountMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
