import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export type MiniConsumptionSparklinePoint = {
  periodKey: string;
  label: string;
  value: number;
};

export function MiniConsumptionSparkline({
  points,
  latestLabel,
  latestValue,
  title,
  subtitle,
  cta,
  palette,
  onPress,
  variant = 'card',
}: {
  points: MiniConsumptionSparklinePoint[];
  latestLabel: string;
  latestValue: string;
  title: string;
  subtitle?: string;
  cta?: string;
  palette: (typeof Colors)['light'];
  onPress?: () => void;
  variant?: 'card' | 'compact';
}) {
  const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0);
  const compact = variant === 'compact';

  const content = (
    <View
      style={[
        compact ? styles.compactShell : styles.card,
        !compact
          ? { backgroundColor: palette.surface, borderColor: palette.border }
          : null,
      ]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[compact ? styles.compactTitle : styles.title, { color: palette.headline }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.headerValueBlock}>
          <Text style={[compact ? styles.compactLatestValue : styles.latestValue, { color: palette.headline }]}>
            {latestValue}
          </Text>
          <Text style={[styles.latestLabel, { color: palette.muted }]}>{latestLabel}</Text>
        </View>
      </View>

      <View style={[styles.chartWrap, compact ? styles.compactChartWrap : null]}>
        <View style={[styles.barsRow, compact ? styles.compactBarsRow : null]}>
          {points.map((point, index) => {
            const active = index === points.length - 1;
            const maxHeight = compact ? 36 : 48;
            const minHeight = compact ? 8 : 12;
            const height = maxValue > 0 ? Math.max(minHeight, (point.value / maxValue) * maxHeight) : minHeight;

            return (
              <View key={point.periodKey} style={styles.barItem}>
                <View style={[styles.barTrack, compact ? styles.compactBarTrack : null]}>
                  <View
                    style={[
                      styles.bar,
                      compact ? styles.compactBar : null,
                      {
                        height,
                        backgroundColor: active ? palette.accent : palette.accentSoft,
                        borderColor: active ? palette.accent : palette.border,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: active ? palette.headline : palette.muted }]}>
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {!compact && cta ? <Text style={[styles.cta, { color: palette.accent }]}>{cta}</Text> : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  compactShell: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  headerValueBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  latestValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  compactLatestValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  latestLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chartWrap: {
    paddingTop: 2,
  },
  compactChartWrap: {
    paddingTop: 0,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 72,
  },
  compactBarsRow: {
    minHeight: 52,
    gap: 6,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    height: 52,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  compactBarTrack: {
    height: 38,
  },
  bar: {
    width: '68%',
    minWidth: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  compactBar: {
    width: '76%',
    minWidth: 12,
    borderRadius: 10,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  cta: {
    fontSize: 12,
    fontWeight: '800',
  },
});
