import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listClientReadings, type MobileReading } from '@/lib/api/mobile-readings';
import { getReviewReasonLabel } from '@/lib/readings/review-reasons';
import { useMobileSession } from '@/providers/mobile-session-provider';

type HistoryFilter = 'ALL' | 'PENDING' | 'VALIDATED' | 'FLAGGED' | 'REJECTED';

export default function ReadingsHistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { session, logout } = useMobileSession();
  const [readings, setReadings] = useState<MobileReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [showFilterSelect, setShowFilterSelect] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReadings() {
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await listClientReadings(session.accessToken);
        if (!active) return;
        setReadings(result.readings);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : 'Impossible de charger les relevés.';
        setError(message);

        if (message.includes('Session invalide')) {
          logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReadings();

    return () => {
      active = false;
    };
  }, [logout, session?.accessToken]);

  const filteredReadings =
    filter === 'ALL' ? readings : readings.filter((reading) => reading.status === filter);

  return (
    <RequireMobileAuth>
      <AppPage title="Relevés" subtitle="Historique de soumission" topBarMode="back" backHref="/(tabs)">
        <Pressable
          onPress={() => setShowFilterSelect(true)}
          style={[styles.filterSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.filterSelectLeft}>
            <Ionicons name="filter-outline" size={18} color={palette.icon} />
            <Text style={[styles.filterSelectLabel, { color: palette.muted }]}>Statut</Text>
          </View>
          <View style={styles.filterSelectRight}>
            <Text style={[styles.filterSelectValue, { color: palette.headline }]}>
              {HISTORY_FILTERS.find((item) => item.value === filter)?.label ?? 'Tous'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.icon} />
          </View>
        </Pressable>

        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : filteredReadings.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.muted }]}>Aucun relevé disponible pour le moment.</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {filteredReadings.map((reading) => (
              <Pressable
                key={reading.id}
                onPress={() => router.push(`/readings/${reading.id}`)}
                style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.code, { color: palette.headline }]}>{reading.meter.serialNumber}</Text>
                    <Text style={[styles.meta, { color: palette.muted }]}>
                      {formatDisplayDate(reading.readingAt)}
                    </Text>
                    {reading.status === 'FLAGGED' || reading.status === 'REJECTED' ? (
                      <Text style={[styles.reasonText, { color: palette.muted }]}>
                        {getReviewReasonLabel(reading.flagReason || reading.rejectionReason) || 'Décision en cours'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, statusPillStyle(reading.status, palette)]}>
                    <Text style={[styles.statusText, statusTextStyle(reading.status, palette)]}>
                      {humanizeStatus(reading.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.indexBlock}>
                  {reading.meter.type === 'DUAL_INDEX' ? (
                    <>
                      <View style={styles.indexRow}>
                        <View style={styles.indexLabelRow}>
                          <Ionicons name="flash-outline" size={14} color={palette.accent} />
                          <Text style={[styles.indexLabel, { color: palette.muted }]}>P1</Text>
                        </View>
                        <Text style={[styles.indexValue, { color: palette.headline }]}>
                          {reading.primaryIndex ?? '--'}
                        </Text>
                      </View>

                      <View style={styles.indexRow}>
                        <View style={styles.indexLabelRow}>
                          <Ionicons name="flash-outline" size={14} color={palette.accent} />
                          <Text style={[styles.indexLabel, { color: palette.muted }]}>P2</Text>
                        </View>
                        <Text style={[styles.indexValue, { color: palette.headline }]}>
                          {reading.secondaryIndex ?? '--'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.indexRow}>
                      <View style={styles.indexLabelRow}>
                        <Ionicons name="flash-outline" size={14} color={palette.accent} />
                        <Text style={[styles.indexLabel, { color: palette.muted }]}>Index</Text>
                      </View>
                      <Text style={[styles.indexValue, { color: palette.headline }]}>
                        {reading.primaryIndex ?? '--'}
                      </Text>
                    </View>
                  )}
                </View>
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
                <Text style={[styles.filterModalTitle, { color: palette.headline }]}>Filtrer les relevés</Text>
                <Pressable
                  onPress={() => setShowFilterSelect(false)}
                  style={[styles.filterModalClose, { backgroundColor: palette.surfaceMuted }]}>
                  <Ionicons name="close" size={18} color={palette.icon} />
                </Pressable>
              </View>

              <View style={styles.filterOptions}>
                {HISTORY_FILTERS.map((item) => {
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
  return { backgroundColor: palette.accentSoft };
}

function statusTextStyle(status: string, palette: (typeof Colors)['light']) {
  if (status === 'VALIDATED') return { color: palette.success };
  if (status === 'REJECTED') return { color: palette.danger };
  if (status === 'FLAGGED') return { color: palette.warning };
  return { color: palette.primary };
}

function humanizeStatus(status: string) {
  switch (status) {
    case 'VALIDATED':
      return 'Validé';
    case 'REJECTED':
      return 'Rejeté';
    case 'FLAGGED':
      return 'Signalé';
    case 'PENDING':
      return 'En attente';
    default:
      return status;
  }
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR', {
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
});

const HISTORY_FILTERS: { label: string; value: HistoryFilter }[] = [
  { label: 'Tous', value: 'ALL' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Validés', value: 'VALIDATED' },
  { label: 'Signalés', value: 'FLAGGED' },
  { label: 'Rejetés', value: 'REJECTED' },
];
