import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Colors } from '@/constants/theme';

type AppStateCardProps = {
  palette: (typeof Colors)['light'];
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  tone?: 'neutral' | 'accent' | 'warning' | 'danger';
  actionLabel?: string;
  onActionPress?: () => void;
};

export function AppStateCard({
  palette,
  icon,
  title,
  description,
  tone = 'neutral',
  actionLabel,
  onActionPress,
}: AppStateCardProps) {
  const toneColors = resolveToneColors(tone, palette);

  return (
    <View style={[styles.card, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: toneColors.background,
            borderColor: toneColors.border,
          },
        ]}>
        <Ionicons name={icon} size={22} color={toneColors.icon} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: palette.headline }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: toneColors.text }]}>{description}</Text>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={[styles.actionButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.actionButtonText, { color: palette.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function resolveToneColors(tone: AppStateCardProps['tone'], palette: (typeof Colors)['light']) {
  switch (tone) {
    case 'danger':
      return {
        background: '#fff0ef',
        border: '#efc0bb',
        icon: palette.danger,
        text: palette.danger,
      };
    case 'warning':
      return {
        background: '#fff6e7',
        border: '#f3c98b',
        icon: '#c77c11',
        text: '#9a6514',
      };
    case 'accent':
      return {
        background: palette.accentSoft,
        border: `${palette.accent}22`,
        icon: palette.accent,
        text: palette.muted,
      };
    default:
      return {
        background: palette.surface,
        border: palette.border,
        icon: palette.icon,
        text: palette.muted,
      };
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    gap: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  actionButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
