import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { AppStateCard } from '@/components/app/app-state-card';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import {
  ConsumptionTrendChart,
  type ConsumptionTrendPoint,
} from '@/components/consumption/consumption-trend-chart';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { listClientConsumption } from '@/lib/api/mobile-consumption';
import type { MobileConsumptionEntry, MobileConsumptionMeter } from '@/lib/api/mobile-consumption';
import { getCustomerMeterIndexLabels } from '@/lib/meters/index-labels';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ConsumptionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { logout } = useMobileSession();
  const { safePush } = useSafePush();
  const [meters, setMeters] = useState<MobileConsumptionMeter[]>([]);
  const [entries, setEntries] = useState<MobileConsumptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('ALL');
  const [showMeterSelect, setShowMeterSelect] = useState(false);
  const hasConsumptionData = meters.length > 0 || entries.length > 0;

  const loadConsumption = useCallback(async (
      activeRef: { current: boolean } = { current: true },
      options: { mode?: 'initial' | 'refresh' | 'background' } = {}
    ) => {
      const mode = options.mode ?? 'initial';

      if (mode === 'refresh') {
        setRefreshing(true);
      } else if (mode === 'initial') {
        setLoading(true);
      }

      try {
        setError(null);
        const result = await listClientConsumption({
          meterId: selectedMeterId === 'ALL' ? undefined : selectedMeterId,
          limit: 12,
        });
        if (!activeRef.current) return;
        setMeters(result.meters);
        setEntries(result.consumptions);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('consumption.loadingFallback'));
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
    }, [logout, selectedMeterId, t]);

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadConsumption(activeRef, { mode: hasConsumptionData ? 'background' : 'initial' });

      return () => {
        activeRef.current = false;
      };
    }, [hasConsumptionData, loadConsumption])
  );

  const selectedMeterLabel = useMemo(() => {
    if (selectedMeterId === 'ALL') return t('common.allMeters');
    return meters.find((meter) => meter.id === selectedMeterId)?.serialNumber ?? t('common.meter');
  }, [meters, selectedMeterId, t]);

  const selectedMeter = useMemo(
    () => meters.find((meter) => meter.id === selectedMeterId) ?? null,
    [meters, selectedMeterId]
  );

  const chartPoints = useMemo<ConsumptionTrendPoint[]>(() => {
    const grouped = new Map<
      string,
      {
        periodKey: string;
        effectiveAt: string;
        totalConsumption: number;
        primaryConsumption: number;
        secondaryConsumption: number | null;
      }
    >();

    for (const entry of entries) {
      const existing = grouped.get(entry.periodKey);
      const nextSecondary = entry.secondaryConsumption ?? 0;

      if (existing) {
        existing.totalConsumption += entry.totalConsumption;
        existing.primaryConsumption += entry.primaryConsumption;
        existing.secondaryConsumption =
          existing.secondaryConsumption === null && entry.secondaryConsumption === null
            ? null
            : (existing.secondaryConsumption ?? 0) + nextSecondary;

        if (new Date(entry.effectiveAt).getTime() > new Date(existing.effectiveAt).getTime()) {
          existing.effectiveAt = entry.effectiveAt;
        }

        continue;
      }

      grouped.set(entry.periodKey, {
        periodKey: entry.periodKey,
        effectiveAt: entry.effectiveAt,
        totalConsumption: entry.totalConsumption,
        primaryConsumption: entry.primaryConsumption,
        secondaryConsumption: entry.secondaryConsumption,
      });
    }

    return [...grouped.values()]
      .sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime())
      .slice(-6)
      .map((item) => ({
        periodKey: item.periodKey,
        shortLabel: formatPeriodLabel(item.periodKey, locale, 'short'),
        fullLabel: formatPeriodLabel(item.periodKey, locale, 'long'),
        totalConsumption: item.totalConsumption,
        primaryConsumption: item.primaryConsumption,
        secondaryConsumption: item.secondaryConsumption,
      }));
  }, [entries, locale]);

  const chartLabels =
    (() => {
      const effectiveMeterType =
        selectedMeterId === 'ALL'
          ? meters.length === 1
            ? meters[0]?.type
            : null
          : selectedMeter?.type;

      if (effectiveMeterType === 'DUAL_INDEX') {
        const labels = getCustomerMeterIndexLabels(effectiveMeterType, t);
        return {
          primary: labels.primaryConsumption,
          secondary: labels.secondaryConsumption,
        };
      }

      return {
        primary: null,
        secondary: null,
      };
    })();

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('common.consumption')}
        subtitle={t('consumption.subtitle')}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadConsumption({ current: true }, { mode: 'refresh' })}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
        <Pressable
          onPress={() => setShowMeterSelect(true)}
          style={[styles.filterSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.filterSelectLeft}>
            <Ionicons name="flash-outline" size={18} color={palette.icon} />
            <Text style={[styles.filterSelectLabel, { color: palette.muted }]}>{t('consumption.filterLabel')}</Text>
          </View>
          <View style={styles.filterSelectRight}>
            <Text
              numberOfLines={1}
              style={[styles.filterSelectValue, { color: palette.headline }]}>
              {selectedMeterLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.icon} />
          </View>
        </Pressable>

        {loading && !hasConsumptionData ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error && !hasConsumptionData ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('consumption.loadingErrorTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadConsumption()}
          />
        ) : entries.length === 0 ? (
          <AppStateCard
            palette={palette}
            icon="stats-chart-outline"
            title={t('consumption.emptyTitle')}
            description={t('consumption.emptyDescription')}
          />
        ) : (
          <View style={styles.stack}>
            {chartPoints.length > 0 ? (
              <ConsumptionTrendChart
                points={chartPoints}
                palette={palette}
                labels={{
                  title: t('consumption.chartTitle'),
                  total: t('consumption.chartTotal'),
                  primary: chartLabels.primary,
                  secondary: chartLabels.secondary,
                }}
              />
            ) : null}

            {entries.map((entry) => (
              <Pressable
                key={`${entry.meterId}-${entry.periodKey}`}
                onPress={() =>
                  safePush({
                    pathname: '/consumption/[meterId]',
                    params: { meterId: entry.meterId, periodKey: entry.periodKey },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}>
                <View style={styles.rowBetween}>
                  <View style={styles.periodBlock}>
                    <Text style={[styles.periodTitle, { color: palette.headline }]}>
                      {formatPeriodLabel(entry.periodKey, locale, 'long')}
                    </Text>
                    <Text style={[styles.periodMeta, { color: palette.muted }]}>{entry.meterSerialNumber}</Text>
                  </View>
                  <View style={styles.totalBlock}>
                    <Text style={[styles.totalValue, { color: palette.headline }]}>
                      {formatConsumption(entry.totalConsumption)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={palette.icon} />
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <MetricPill
                    label={getCustomerMeterIndexLabels(entry.meterType, t).primaryConsumption}
                    value={formatConsumption(entry.primaryConsumption)}
                    palette={palette}
                  />
                  {entry.meterType === 'DUAL_INDEX' ? (
                    <MetricPill
                      label={getCustomerMeterIndexLabels(entry.meterType, t).secondaryConsumption}
                      value={formatConsumption(entry.secondaryConsumption)}
                      palette={palette}
                    />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Modal
          visible={showMeterSelect}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMeterSelect(false)}>
          <View style={styles.filterModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMeterSelect(false)} />
            <View
              style={[
                styles.filterModalCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}>
              <View style={styles.filterModalHeader}>
                <Text style={[styles.filterModalTitle, { color: palette.headline }]}>
                  {t('consumption.filterTitle')}
                </Text>
                <Pressable
                  onPress={() => setShowMeterSelect(false)}
                  style={[styles.filterModalClose, { backgroundColor: palette.surfaceMuted }]}>
                  <Ionicons name="close" size={18} color={palette.icon} />
                </Pressable>
              </View>

              <View style={styles.filterOptions}>
                {[{ id: 'ALL', serialNumber: t('common.allMeters') }, ...meters].map((meter) => {
                  const active = selectedMeterId === meter.id;
                  return (
                    <Pressable
                      key={meter.id}
                      onPress={() => {
                        setSelectedMeterId(meter.id);
                        setShowMeterSelect(false);
                      }}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: active ? palette.accentSoft : palette.surfaceMuted,
                          borderColor: active ? palette.accent : palette.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.filterOptionText,
                          { color: active ? palette.primary : palette.headline },
                        ]}>
                        {meter.serialNumber}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={18} color={palette.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </AppPage>
    </RequireMobileAuth>
  );
}

function MetricPill({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.metricPill, { backgroundColor: palette.surfaceMuted }]}>
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

function formatConsumption(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(0)} kWh`;
}

function formatPeriodLabel(periodKey: string, locale: string, style: 'short' | 'long') {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return periodKey;
  }

  const [year, month] = periodKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString(locale, {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  filterSelect: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  filterSelectLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterSelectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSelectLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterSelectValue: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
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
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  periodBlock: {
    flex: 1,
    gap: 4,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  periodMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  totalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 23, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  filterModalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  filterModalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptions: {
    gap: 10,
  },
  filterOption: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
