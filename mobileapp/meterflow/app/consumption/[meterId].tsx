import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getClientConsumptionDetail,
  type MobileConsumptionDetail,
} from '@/lib/api/mobile-consumption';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ConsumptionDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const params = useLocalSearchParams<{ meterId?: string; periodKey?: string }>();
  const { logout } = useMobileSession();
  const [detail, setDetail] = useState<MobileConsumptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!params.meterId || !params.periodKey) {
        setError('Période de consommation manquante.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getClientConsumptionDetail(params.meterId, params.periodKey);
        if (!active) return;
        setDetail(result.consumption);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Impossible de charger le détail.';
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

    void loadDetail();

    return () => {
      active = false;
    };
  }, [logout, params.meterId, params.periodKey]);

  return (
    <RequireMobileAuth>
      <AppPage title="Détail consommation" subtitle="Période mensuelle" topBarMode="back" backHref="/(tabs)/account">
        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <StateCard text={error} color={palette.danger} palette={palette} />
        ) : !detail ? (
          <StateCard text="Consommation introuvable." color={palette.muted} palette={palette} />
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.heroTitle, { color: palette.headline }]}>{detail.periodLabel}</Text>
              <Text style={[styles.heroMeta, { color: palette.muted }]}>{detail.meter.serialNumber}</Text>
              <Text style={[styles.heroTotal, { color: palette.headline }]}>
                {formatConsumption(detail.totalConsumption)}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Synthèse</Text>
              <View style={styles.metricsRow}>
                <MetricItem label="P1" value={formatConsumption(detail.primaryConsumption)} palette={palette} />
                {detail.meter.type === 'DUAL_INDEX' ? (
                  <MetricItem
                    label="P2"
                    value={formatConsumption(detail.secondaryConsumption)}
                    palette={palette}
                  />
                ) : null}
              </View>
              <View style={styles.metricsRow}>
                <MetricItem
                  label="Zone"
                  value={[detail.meter.city, detail.meter.zone].filter(Boolean).join(' / ') || '--'}
                  palette={palette}
                />
                <MetricItem
                  label="Référence"
                  value={detail.meter.meterReference || '--'}
                  palette={palette}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>États utilisés</Text>
              <View style={styles.itemsStack}>
                {detail.items.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.itemRow, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
                    <View style={styles.itemHead}>
                      <Text style={[styles.itemDate, { color: palette.headline }]}>
                        {formatDate(item.effectiveAt)}
                      </Text>
                      <Text style={[styles.itemReadingRef, { color: palette.muted }]}>
                        {item.sourceReadingId ? `Relevé ${item.sourceReadingId.slice(0, 8)}` : 'État système'}
                      </Text>
                    </View>

                    <View style={styles.itemMetrics}>
                      <MetricLine
                        label="P1"
                        previous={item.previousPrimary}
                        current={item.currentPrimary}
                        delta={item.deltaPrimary}
                        palette={palette}
                      />
                      {detail.meter.type === 'DUAL_INDEX' ? (
                        <MetricLine
                          label="P2"
                          previous={item.previousSecondary}
                          current={item.currentSecondary}
                          delta={item.deltaSecondary}
                          palette={palette}
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function MetricItem({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

function MetricLine({
  label,
  previous,
  current,
  delta,
  palette,
}: {
  label: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.metricLine}>
      <Text style={[styles.metricLineLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.metricLineValue, { color: palette.headline }]}>
        {formatNumber(previous)} → {formatNumber(current)}
      </Text>
      <Text style={[styles.metricLineDelta, { color: palette.accent }]}>+{formatNumber(delta)} kWh</Text>
    </View>
  );
}

function StateCard({
  text,
  color,
  palette,
}: {
  text: string;
  color: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
      <Text style={[styles.stateText, { color }]}>{text}</Text>
    </View>
  );
}

function formatConsumption(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(0)} kWh`;
}

function formatNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) return '--';
  return value.toFixed(0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
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
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  heroMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroTotal: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  itemsStack: {
    gap: 10,
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  itemHead: {
    gap: 4,
  },
  itemDate: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemReadingRef: {
    fontSize: 12,
    lineHeight: 17,
  },
  itemMetrics: {
    gap: 8,
  },
  metricLine: {
    gap: 4,
  },
  metricLineLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricLineValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricLineDelta: {
    fontSize: 13,
    fontWeight: '800',
  },
});
