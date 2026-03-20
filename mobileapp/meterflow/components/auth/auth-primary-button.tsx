import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AuthPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
};

export function AuthPrimaryButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
}: AuthPrimaryButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width, height } = useWindowDimensions();
  const compact = width < 370 || height < 760;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          backgroundColor: palette.headline,
          minHeight: compact ? 52 : 56,
          borderRadius: compact ? 16 : 18,
          opacity: isDisabled ? 0.72 : 1,
        },
      ]}>
      <View style={styles.content}>
        <Text style={[styles.label, { fontSize: compact ? 14 : 15 }]}>{label}</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 17 : 18} color="#ffffff" />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
