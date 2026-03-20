import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafePush } from '@/hooks/use-safe-push';
import { useMobileDrawer } from '@/providers/mobile-drawer-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

type AppTopBarProps = {
  title: string;
  mode?: 'drawer' | 'back';
  backHref?: Href;
  onBackPress?: () => void;
};

export function AppTopBar({ title, mode = 'drawer', backHref, onBackPress }: AppTopBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { openDrawer } = useMobileDrawer();
  const { unreadCount } = useMobileNotifications();
  const router = useRouter();
  const { safePush } = useSafePush();

  function handleLeadingAction() {
    if (mode === 'back') {
      if (onBackPress) {
        onBackPress();
        return;
      }

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
        style={[styles.actionButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Ionicons name={mode === 'back' ? 'arrow-back' : 'menu-outline'} size={22} color={palette.headline} />
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: palette.headline }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        onPress={() => safePush('/notifications')}
        style={[styles.actionButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Ionicons name="notifications-outline" size={20} color={palette.headline} />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: palette.danger }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
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
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});
