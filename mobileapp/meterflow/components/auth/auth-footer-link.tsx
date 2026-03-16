import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AuthFooterLinkProps = {
  label: string;
  actionLabel: string;
  onPress: () => void;
};

export function AuthFooterLink({ label, actionLabel, onPress }: AuthFooterLinkProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      <Pressable onPress={onPress}>
        <Text style={[styles.action, { color: palette.accent }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 14,
  },
  action: {
    fontSize: 14,
    fontWeight: '800',
  },
});
