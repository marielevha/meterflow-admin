import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { AppStateCard } from '@/components/app/app-state-card';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { listClientConsumption, type MobileConsumptionEntry } from '@/lib/api/mobile-consumption';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { listClientMeters, type MobileMeter } from '@/lib/api/mobile-meters';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

type DashboardData = {
  meters: MobileMeter[];
  consumptions: MobileConsumptionEntry[];
};

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const { session, logout } = useMobileSession();
  const { unreadCount } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    meters: [],
    consumptions: [],
  });
  const [activeMeterIndex, setActiveMeterIndex] = useState(0);

  const hasDashboardData =
    dashboardData.meters.length > 0 || dashboardData.consumptions.length > 0;

  const loadDashboard = useCallback(async (
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
        const [metersResult, consumptionsResult] = await Promise.all([
          listClientMeters(session.accessToken),
          listClientConsumption({ limit: 12 }),
        ]);

        if (!activeRef.current) return;
        setDashboardData({
          meters: metersResult.meters,
          consumptions: consumptionsResult.consumptions,
        });
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(
          loadError,
          t('home.metersUnavailableTitle')
        );
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
      void loadDashboard(activeRef, { mode: hasDashboardData ? 'background' : 'initial' });

      return () => {
        activeRef.current = false;
      };
    }, [hasDashboardData, loadDashboard])
  );

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
      <AppPage
        title={t('common.home')}
        subtitle={t('home.subtitle')}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard({ current: true }, { mode: 'refresh' })}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
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
          {loading && !hasDashboardData ? (
            <View style={styles.readingsLoadingWrap}>
              <CircularLoading palette={palette} />
            </View>
          ) : error && !hasDashboardData ? (
            <AppStateCard
              palette={palette}
              icon="cloud-offline-outline"
              title={t('home.metersUnavailableTitle')}
              description={error}
              tone="danger"
              actionLabel={t('common.retry')}
              onActionPress={() => void loadDashboard()}
            />
          ) : dashboardData.meters.length === 0 ? (
            <AppStateCard
              palette={palette}
              icon="flash-outline"
              title={t('home.noMeterTitle')}
              description={t('home.noMeterDescription')}
            />
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
                      onPress={() => safePush(`/meters/${meter.id}`)}
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
                          <Text style={[styles.financeCardLabel, { color: palette.muted }]}>{t('home.meterLabel')}</Text>
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
                            {humanizeMeterStatus(meter.status, t)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.financeBottomRow}>
                        <View style={styles.financeMetric}>
                          <Text style={[styles.financeMetricLabel, { color: palette.muted }]}>
                            {t('home.primaryIndex')}
                          </Text>
                          <Text style={[styles.financeMetricValue, { color: palette.headline }]}>
                            {latestState?.currentPrimary?.toString() || '--'}
                          </Text>
                        </View>
                        {meter.type === 'DUAL_INDEX' ? (
                          <View style={styles.financeMetric}>
                            <Text style={[styles.financeMetricLabel, { color: palette.muted }]}>
                              {t('home.secondaryIndex')}
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

        <Pressable
          onPress={() => safePush('/notifications')}
          style={[
            styles.notificationsShortcut,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}>
          <View style={[styles.notificationsShortcutIcon, { backgroundColor: palette.surfaceMuted }]}>
            <Ionicons name="notifications-outline" size={18} color={palette.accent} />
            {unreadCount > 0 ? (
              <View style={[styles.notificationsShortcutBadge, { backgroundColor: palette.danger }]}>
                <Text style={styles.notificationsShortcutBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.notificationsShortcutBody}>
            <Text style={[styles.notificationsShortcutTitle, { color: palette.headline }]}>
              {t('common.notifications')}
            </Text>
            <Text style={[styles.notificationsShortcutSubtitle, { color: palette.muted }]}>
              {unreadCount > 0
                ? t('home.notificationsNewMessages', {
                    count: unreadCount,
                    x: unreadCount > 1 ? 'x' : '',
                    s: unreadCount > 1 ? 's' : '',
                  })
                : t('home.notificationsNoNew')}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              numberOfLines={2}
              style={[styles.sectionTitle, { color: palette.headline }]}>
              {t('home.latestConsumptions')}
            </Text>
            <Pressable onPress={() => safePush('/(tabs)/account')}>
              <Text style={[styles.sectionLink, { color: palette.accent }]}>{t('home.viewAll')}</Text>
            </Pressable>
          </View>

          {loading && !hasDashboardData ? (
            <View style={styles.readingsLoadingWrap}>
              <CircularLoading palette={palette} />
            </View>
          ) : error && !hasDashboardData ? (
            <AppStateCard
              palette={palette}
              icon="cloud-offline-outline"
              title={t('home.consumptionsUnavailableTitle')}
              description={error}
              tone="danger"
              actionLabel={t('common.retry')}
              onActionPress={() => void loadDashboard()}
            />
          ) : latestConsumptions.length === 0 ? (
            <AppStateCard
              palette={palette}
              icon="stats-chart-outline"
              title={t('home.noConsumptionTitle')}
              description={t('home.noConsumptionDescription')}
            />
          ) : (
            <View style={styles.readingsList}>
              {latestConsumptions.map((consumption) => (
                <Pressable
                  key={`${consumption.meterId}-${consumption.periodKey}`}
                  onPress={() =>
                    safePush({
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
                      <Text style={[styles.readingAmountMeta, { color: palette.muted }]}>
                        {t('home.consumptionLabel')}
                      </Text>
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

function humanizeMeterStatus(status: string, t: (key: string) => string) {
  switch (status) {
    case 'ACTIVE':
      return t('common.status.active');
    case 'INACTIVE':
      return t('common.status.inactive');
    case 'MAINTENANCE':
      return t('common.status.maintenance');
    case 'REPLACED':
      return t('common.status.replaced');
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
  notificationsShortcut: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationsShortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsShortcutBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsShortcutBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  notificationsShortcutBody: {
    flex: 1,
    gap: 4,
  },
  notificationsShortcutTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  notificationsShortcutSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
