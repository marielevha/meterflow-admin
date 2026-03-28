import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { AppStateCard } from '@/components/app/app-state-card';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { listClientReadings, type MobileReading } from '@/lib/api/mobile-readings';
import { getCustomerMeterIndexLabels } from '@/lib/meters/index-labels';
import { useMobileSession } from '@/providers/mobile-session-provider';

type HistoryFilter =
  | 'ALL'
  | 'PENDING'
  | 'VALIDATED'
  | 'FLAGGED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUESTED';

export default function ReadingsHistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { session, logout } = useMobileSession();
  const { safePush } = useSafePush();
  const [readings, setReadings] = useState<MobileReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [showFilterSelect, setShowFilterSelect] = useState(false);
  const hasReadingsData = readings.length > 0;

  const loadReadings = useCallback(async (
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
        const result = await listClientReadings(session.accessToken);
        if (!activeRef.current) return;
        setReadings(result.readings);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('history.fallback'));
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
      void loadReadings(activeRef, { mode: hasReadingsData ? 'background' : 'initial' });

      return () => {
        activeRef.current = false;
      };
    }, [hasReadingsData, loadReadings])
  );

  const filteredReadings =
    filter === 'ALL' ? readings : readings.filter((reading) => reading.status === filter);

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        topBarMode="back"
        backHref="/(tabs)"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadReadings({ current: true }, { mode: 'refresh' })}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
        <Pressable
          onPress={() => setShowFilterSelect(true)}
          style={[styles.filterSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.filterSelectLeft}>
            <Ionicons name="filter-outline" size={18} color={palette.icon} />
            <Text style={[styles.filterSelectLabel, { color: palette.muted }]}>{t('history.filterLabel')}</Text>
          </View>
          <View style={styles.filterSelectRight}>
            <Text style={[styles.filterSelectValue, { color: palette.headline }]}>
              {getHistoryFilters(t).find((item) => item.value === filter)?.label ?? t('history.filter.all')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.icon} />
          </View>
        </Pressable>

        {loading && !hasReadingsData ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error && !hasReadingsData ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('history.unavailableTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadReadings()}
          />
        ) : filteredReadings.length === 0 ? (
          <AppStateCard
            palette={palette}
            icon="receipt-outline"
            title={t('history.emptyTitle')}
            description={t('history.emptyDescription')}
          />
        ) : (
          <View style={styles.stack}>
            {filteredReadings.map((reading) => (
              <Pressable
                key={reading.id}
                onPress={() => safePush(`/readings/${reading.id}`)}
                style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.code, { color: palette.headline }]}>{reading.meter.serialNumber}</Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>
                      {formatDisplayDate(reading.readingAt, locale)}
                    </Text>
                    {reading.reasonLabel ? (
                      <Text style={[styles.reasonText, { color: palette.muted }]}>
                        {reading.reasonLabel}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, statusPillStyle(reading.status, palette)]}>
                    <Text style={[styles.statusText, statusTextStyle(reading.status, palette)]}>
                      {reading.statusLabel || '--'}
                    </Text>
                  </View>
                </View>

                <View style={styles.indexBlock}>
                  {reading.meter.type === 'DUAL_INDEX' ? (
                    (() => {
                      const labels = getCustomerMeterIndexLabels(reading.meter.type, t);
                      return (
                    <>
                      <View style={styles.indexRow}>
                        <View style={styles.indexLabelRow}>
                          <Ionicons name="flash-outline" size={14} color={palette.accent} />
                          <Text style={[styles.indexLabel, { color: palette.muted }]}>{labels.primaryConsumption}</Text>
                        </View>
                        <Text style={[styles.indexValue, { color: palette.headline }]}>
                          {reading.primaryIndex ?? '--'}
                        </Text>
                      </View>

                      <View style={styles.indexRow}>
                        <View style={styles.indexLabelRow}>
                          <Ionicons name="flash-outline" size={14} color={palette.accent} />
                          <Text style={[styles.indexLabel, { color: palette.muted }]}>{labels.secondaryConsumption}</Text>
                        </View>
                        <Text style={[styles.indexValue, { color: palette.headline }]}>
                          {reading.secondaryIndex ?? '--'}
                        </Text>
                      </View>
                    </>
                      );
                    })()
                  ) : (
                    <View style={styles.indexRow}>
                      <View style={styles.indexLabelRow}>
                        <Ionicons name="flash-outline" size={14} color={palette.accent} />
                        <Text style={[styles.indexLabel, { color: palette.muted }]}>{t('common.index')}</Text>
                      </View>
                      <Text style={[styles.indexValue, { color: palette.headline }]}>
                        {reading.primaryIndex ?? '--'}
                      </Text>
                    </View>
                  )}
                </View>

                {reading.canResubmit ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      safePush({
                        pathname: '/(tabs)/readings',
                        params: {
                          resubmitReadingId: reading.id,
                          meterId: reading.meterId,
                        },
                      });
                    }}
                    style={[styles.resubmitButton, { backgroundColor: palette.accentSoft }]}>
                    <Ionicons name="camera-outline" size={16} color={palette.accent} />
                    <Text style={[styles.resubmitButtonText, { color: palette.primary }]}>
                      {t('history.resubmit')}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Modal
          visible={showFilterSelect}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFilterSelect(false)}>
          <View style={styles.filterModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterSelect(false)} />
            <View
              style={[
                styles.filterModalCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}>
              <View style={styles.filterModalHeader}>
                <Text style={[styles.filterModalTitle, { color: palette.headline }]}>{t('history.filterModalTitle')}</Text>
                <Pressable
                  onPress={() => setShowFilterSelect(false)}
                  style={[styles.filterModalClose, { backgroundColor: palette.surfaceMuted }]}>
                  <Ionicons name="close" size={18} color={palette.icon} />
                </Pressable>
              </View>

              <View style={styles.filterOptions}>
                {getHistoryFilters(t).map((item) => {
                  const active = filter === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => {
                        setFilter(item.value);
                        setShowFilterSelect(false);
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
                        {item.label}
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

function statusPillStyle(status: string, palette: (typeof Colors)['light']) {
  if (status === 'VALIDATED') return { backgroundColor: `${palette.success}1f` };
  if (status === 'REJECTED') return { backgroundColor: `${palette.danger}1a` };
  if (status === 'FLAGGED') return { backgroundColor: `${palette.warning}1f` };
  if (status === 'RESUBMISSION_REQUESTED') return { backgroundColor: `${palette.warning}1f` };
  return { backgroundColor: palette.accentSoft };
}

function statusTextStyle(status: string, palette: (typeof Colors)['light']) {
  if (status === 'VALIDATED') return { color: palette.success };
  if (status === 'REJECTED') return { color: palette.danger };
  if (status === 'FLAGGED') return { color: palette.warning };
  if (status === 'RESUBMISSION_REQUESTED') return { color: palette.warning };
  return { color: palette.primary };
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
  },
  filterSelectLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterSelectValue: {
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  indexValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  indexBlock: {
    gap: 8,
  },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  indexLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indexLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  resubmitButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  resubmitButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

function getHistoryFilters(t: (key: string) => string): { label: string; value: HistoryFilter }[] {
  return [
    { label: t('history.filter.all'), value: 'ALL' },
    { label: t('history.filter.pending'), value: 'PENDING' },
    { label: t('history.filter.validated'), value: 'VALIDATED' },
    { label: t('history.filter.flagged'), value: 'FLAGGED' },
    { label: t('history.filter.rejected'), value: 'REJECTED' },
    { label: t('history.filter.resubmissionRequested'), value: 'RESUBMISSION_REQUESTED' },
  ];
}
