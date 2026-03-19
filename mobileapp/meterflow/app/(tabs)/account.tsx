import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listClientConsumption } from '@/lib/api/mobile-consumption';
import type { MobileConsumptionEntry, MobileConsumptionMeter } from '@/lib/api/mobile-consumption';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ConsumptionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { logout } = useMobileSession();
  const [meters, setMeters] = useState<MobileConsumptionMeter[]>([]);
  const [entries, setEntries] = useState<MobileConsumptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('ALL');
  const [showMeterSelect, setShowMeterSelect] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadConsumption() {
      setLoading(true);
      setError(null);

      try {
        const result = await listClientConsumption({
          meterId: selectedMeterId === 'ALL' ? undefined : selectedMeterId,
          limit: 12,
        });
        if (!active) return;
        setMeters(result.meters);
        setEntries(result.consumptions);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Impossible de charger la consommation.';
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

    void loadConsumption();

    return () => {
      active = false;
    };
  }, [logout, selectedMeterId]);

  const selectedMeterLabel = useMemo(() => {
    if (selectedMeterId === 'ALL') return 'Tous les compteurs';
    return meters.find((meter) => meter.id === selectedMeterId)?.serialNumber ?? 'Compteur';
  }, [meters, selectedMeterId]);

  return (
    <RequireMobileAuth>
      <AppPage title="Consommation" subtitle="Historique mensuel">
        <Pressable
          onPress={() => setShowMeterSelect(true)}
          style={[styles.filterSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.filterSelectLeft}>
            <Ionicons name="flash-outline" size={18} color={palette.icon} />
            <Text style={[styles.filterSelectLabel, { color: palette.muted }]}>Compteur</Text>
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

        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.stateText, { color: palette.muted }]}>
              Aucune consommation calculée pour le moment.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {entries.map((entry) => (
              <Pressable
                key={`${entry.meterId}-${entry.periodKey}`}
                onPress={() =>
                  router.push({
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
                    <Text style={[styles.periodTitle, { color: palette.headline }]}>{entry.periodLabel}</Text>
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
                  <MetricPill label="P1" value={formatConsumption(entry.primaryConsumption)} palette={palette} />
                  {entry.meterType === 'DUAL_INDEX' ? (
                    <MetricPill
                      label="P2"
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
                  Filtrer la consommation
                </Text>
                <Pressable
                  onPress={() => setShowMeterSelect(false)}
                  style={[styles.filterModalClose, { backgroundColor: palette.surfaceMuted }]}>
                  <Ionicons name="close" size={18} color={palette.icon} />
                </Pressable>
              </View>

              <View style={styles.filterOptions}>
                {[{ id: 'ALL', serialNumber: 'Tous les compteurs' }, ...meters].map((meter) => {
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
