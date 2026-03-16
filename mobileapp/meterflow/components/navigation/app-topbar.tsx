import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMobileDrawer } from '@/providers/mobile-drawer-provider';

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  mode?: 'drawer' | 'back';
  backHref?: '/(tabs)/account' | '/(tabs)' | '/meters' | '/profile' | '/settings' | '/about';
};

export function AppTopBar({ title, subtitle, mode = 'drawer', backHref }: AppTopBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { openDrawer } = useMobileDrawer();
  const router = useRouter();

  function handleLeadingAction() {
    if (mode === 'back') {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      if (backHref) {
        router.replace(backHref);
      }

      return;
    }

    openDrawer();
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handleLeadingAction}
        style={[styles.menuButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Ionicons
          name={mode === 'back' ? 'arrow-back' : 'menu-outline'}
          size={22}
          color={palette.headline}
        />
      </Pressable>

      <View style={styles.titleBlock}>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.accent }]}>{subtitle}</Text> : null}
        <Text style={[styles.title, { color: palette.headline }]}>{title}</Text>
      </View>

      <View style={[styles.menuButton, styles.placeholder]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    opacity: 0,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
});
