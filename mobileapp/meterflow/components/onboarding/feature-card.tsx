import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FeatureCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
};

export function FeatureCard({ eyebrow, title, description, icon }: FeatureCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.iconBadge, { backgroundColor: palette.accentSoft }]}>{icon}</View>
      <Text style={[styles.eyebrow, { color: palette.accent }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: palette.headline }]}>{title}</Text>
      <Text style={[styles.description, { color: palette.muted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    gap: 10,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
});
