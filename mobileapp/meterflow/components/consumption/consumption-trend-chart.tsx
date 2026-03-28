import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export type ConsumptionTrendPoint = {
  periodKey: string;
  shortLabel: string;
  fullLabel: string;
  totalConsumption: number;
  primaryConsumption: number;
  secondaryConsumption: number | null;
};

export function ConsumptionTrendChart({
  points,
  palette,
  labels,
}: {
  points: ConsumptionTrendPoint[];
  palette: (typeof Colors)['light'];
  labels: {
    title: string;
    total: string;
    primary?: string | null;
    secondary?: string | null;
  };
}) {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(points.at(-1)?.periodKey ?? null);

  const maxConsumption = useMemo(
    () => points.reduce((max, point) => Math.max(max, point.totalConsumption), 0),
    [points]
  );

  const effectiveSelectedPeriodKey = points.some((point) => point.periodKey === selectedPeriodKey)
    ? selectedPeriodKey
    : (points.at(-1)?.periodKey ?? null);

  const selectedPoint =
    points.find((point) => point.periodKey === effectiveSelectedPeriodKey) ?? points.at(-1) ?? null;

  if (!selectedPoint) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: palette.headline }]}>{labels.title}</Text>
          <Text style={[styles.period, { color: palette.muted }]}>{selectedPoint.fullLabel}</Text>
        </View>

        <Text style={[styles.totalHero, { color: palette.headline }]}>
          {formatConsumption(selectedPoint.totalConsumption)}
        </Text>
      </View>

      <View style={styles.chartShell}>
        <View style={[styles.baseline, { backgroundColor: palette.border }]} />
        <View style={styles.barsRow}>
          {points.map((point) => {
            const active = point.periodKey === selectedPoint.periodKey;
            const barHeight =
              maxConsumption > 0 ? Math.max(14, (point.totalConsumption / maxConsumption) * 104) : 14;

            return (
              <Pressable
                key={point.periodKey}
                onPress={() => setSelectedPeriodKey(point.periodKey)}
                style={styles.barPressable}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: active ? palette.accent : palette.accentSoft,
                        borderColor: active ? palette.accent : palette.border,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: active ? palette.headline : palette.muted }]}>
                  {point.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.metricsRow}>
        <MetricPill label={labels.total} value={formatConsumption(selectedPoint.totalConsumption)} palette={palette} />
        {labels.primary ? (
          <MetricPill
            label={labels.primary}
            value={formatConsumption(selectedPoint.primaryConsumption)}
            palette={palette}
          />
        ) : null}
        {labels.secondary && selectedPoint.secondaryConsumption !== null ? (
          <MetricPill
            label={labels.secondary}
            value={formatConsumption(selectedPoint.secondaryConsumption)}
            palette={palette}
          />
        ) : null}
      </View>
    </View>
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
  card: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  period: {
    fontSize: 13,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
  totalHero: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  chartShell: {
    position: 'relative',
    paddingTop: 8,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    height: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 140,
  },
  barPressable: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    width: '100%',
    height: 112,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '72%',
    minWidth: 18,
    borderWidth: 1,
    borderRadius: 14,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: 88,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});
