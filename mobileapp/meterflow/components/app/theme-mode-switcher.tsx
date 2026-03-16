import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAppTheme, type ThemePreference } from '@/providers/app-theme-provider';

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

function iconNameForTheme(option: ThemePreference): keyof typeof Ionicons.glyphMap {
  if (option === 'light') return 'sunny-outline';
  if (option === 'dark') return 'moon-outline';
  return 'phone-portrait-outline';
}

export function ThemeModeSwitcher() {
  const { preference, setPreference, resolvedTheme } = useAppTheme();
  const palette = Colors[resolvedTheme];

  return (
    <View style={[styles.wrapper, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
      {OPTIONS.map((option) => {
        const selected = option === preference;

        return (
          <Pressable
            key={option}
            onPress={() => setPreference(option)}
            style={[
              styles.button,
              {
                backgroundColor: selected ? palette.accent : 'transparent',
              },
            ]}>
            <Ionicons
              name={iconNameForTheme(option)}
              size={18}
              color={selected ? '#ffffff' : palette.muted}
            />
            {option === 'system' ? (
              <Text
                style={[
                  styles.systemLabel,
                  {
                    color: selected ? '#ffffff' : palette.muted,
                  },
                ]}>
                Auto
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  systemLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
