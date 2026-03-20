import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type Insets,
} from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/app/brand-mark';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

type DrawerContextValue = {
  openDrawer: () => void;
  closeDrawer: () => void;
  isOpen: boolean;
};

const MobileDrawerContext = createContext<DrawerContextValue | null>(null);

const MENU_ITEMS = [
  { labelKey: 'common.home', route: '/(tabs)', icon: 'home-outline' as const, matches: ['/', '/(tabs)', '/(tabs)/index'] },
  { labelKey: 'drawer.releves', route: '/readings-history', icon: 'time-outline' as const, matches: ['/readings-history'] },
  { labelKey: 'common.notifications', route: '/notifications', icon: 'notifications-outline' as const, matches: ['/notifications'] },
  { labelKey: 'common.meters', route: '/meters', icon: 'speedometer-outline' as const, matches: ['/meters'] },
  { labelKey: 'common.profile', route: '/profile', icon: 'person-outline' as const, matches: ['/profile'] },
  { labelKey: 'common.settings', route: '/settings', icon: 'settings-outline' as const, matches: ['/settings'] },
  { labelKey: 'common.about', route: '/about', icon: 'information-circle-outline' as const, matches: ['/about'] },
];

export function MobileDrawerProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session, isAuthenticated, logout } = useMobileSession();
  const { unreadCount } = useMobileNotifications();
  const drawerWidth = Math.min(width * 0.82, 340);
  const [translateX] = useState(() => new Animated.Value(-drawerWidth));
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    translateX.setValue(-drawerWidth);
  }, [drawerWidth, translateX]);

  const resetDrawer = useCallback(() => {
    translateX.stopAnimation();
    overlayOpacity.stopAnimation();
    setIsOpen(false);
    setIsMounted(false);
    translateX.setValue(-drawerWidth);
    overlayOpacity.setValue(0);
  }, [drawerWidth, overlayOpacity, translateX]);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    if (!isAuthenticated) return;

    translateX.stopAnimation();
    overlayOpacity.stopAnimation();
    translateX.setValue(-drawerWidth);
    overlayOpacity.setValue(0);
    setIsMounted(true);
    setIsOpen(true);
  }, [drawerWidth, isAuthenticated, overlayOpacity, translateX]);

  useEffect(() => {
    if (!isAuthenticated) {
      const frame = requestAnimationFrame(() => {
        resetDrawer();
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    }
  }, [isAuthenticated, resetDrawer]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      if (isMounted || isOpen) {
        const frame = requestAnimationFrame(() => {
          resetDrawer();
        });
        previousPathnameRef.current = pathname;

        return () => {
          cancelAnimationFrame(frame);
        };
      }
      previousPathnameRef.current = pathname;
    }
  }, [pathname, isMounted, isOpen, resetDrawer]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -drawerWidth,
        duration: isOpen ? 240 : 210,
        easing: isOpen ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: isOpen ? 200 : 180,
        easing: isOpen ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished && !isOpen) {
        setIsMounted(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [drawerWidth, isMounted, isOpen, overlayOpacity, translateX]);

  async function handleLogout() {
    resetDrawer();
    await logout();
    router.replace('/(auth)/login');
  }

  const value = useMemo<DrawerContextValue>(
    () => ({
      openDrawer,
      closeDrawer,
      isOpen,
    }),
    [closeDrawer, isOpen, openDrawer]
  );

  return (
    <MobileDrawerContext.Provider value={value}>
      {children}
      {isAuthenticated && isMounted ? (
        <Modal
          transparent
          animationType="none"
          visible={isMounted}
          onRequestClose={closeDrawer}
          presentationStyle="overFullScreen">
          <View style={styles.modalRoot}>
            <Animated.View
              pointerEvents="none"
              style={[styles.overlay, { opacity: overlayOpacity }]}
            />
            <Pressable style={styles.overlayTapZone} onPress={closeDrawer} />

            <Animated.View
              style={[
                styles.drawer,
                drawerContainerStyle(drawerWidth, insets, palette),
                { transform: [{ translateX }] },
              ]}>
              <View style={styles.drawerHeader}>
                <View style={[styles.brandBadge, { backgroundColor: palette.accentSoft }]}>
                  <BrandMark
                    size={44}
                    backgroundColor={palette.accentSoft}
                    primaryColor={palette.headline}
                    shadowColor={`${palette.accent}66`}
                    shadowColorAlt={`${palette.accent}40`}
                    accentColor={palette.accent}
                  />
                </View>

                <View style={styles.profileBlock}>
                  <Text style={[styles.profileName, { color: palette.headline }]}>
                    {[session?.user.firstName, session?.user.lastName].filter(Boolean).join(' ') || t('common.client')}
                  </Text>
                  <Text style={[styles.profileMeta, { color: palette.muted }]}>
                    {session?.user.username || session?.user.email || session?.user.phone || t('common.clientAccount')}
                  </Text>
                </View>
              </View>

              <View style={styles.menuList}>
                {MENU_ITEMS.map((item) => {
                  const active = item.matches.includes(pathname);

                  return (
                    <Pressable
                      key={item.route}
                      onPress={() => {
                        if (active) {
                          closeDrawer();
                          return;
                        }

                        closeDrawer();
                        router.push(item.route as never);
                      }}
                      style={[
                        styles.menuItem,
                        {
                          backgroundColor: active ? palette.accentSoft : 'transparent',
                        },
                      ]}>
                      <View
                        style={[
                          styles.menuIconWrap,
                          {
                            backgroundColor: active ? palette.surface : palette.surfaceMuted,
                          },
                        ]}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={active ? palette.primary : palette.icon}
                        />
                      </View>
                      <Text
                        style={[
                          styles.menuLabel,
                          { color: active ? palette.headline : palette.text },
                        ]}>
                        {t(item.labelKey)}
                      </Text>

                      {item.route === '/notifications' && unreadCount > 0 ? (
                        <View style={[styles.menuBadge, { backgroundColor: palette.danger }]}>
                          <Text style={styles.menuBadgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={handleLogout}
                style={[styles.logoutButton, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
                <Ionicons name="log-out-outline" size={18} color={palette.danger} />
                <Text style={[styles.logoutLabel, { color: palette.danger }]}>Se deconnecter</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </MobileDrawerContext.Provider>
  );
}

export function useMobileDrawer() {
  const context = useContext(MobileDrawerContext);

  if (!context) {
    throw new Error('useMobileDrawer must be used within MobileDrawerProvider');
  }

  return context;
}

function drawerContainerStyle(width: number, insets: Insets, palette: (typeof Colors)['light']) {
  return {
    width,
    paddingTop: insets.top + 16,
    paddingBottom: insets.bottom + 22,
    backgroundColor: palette.surface,
    borderRightColor: palette.border,
  };
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,10,24,0.46)',
  },
  overlayTapZone: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    paddingHorizontal: 18,
    shadowColor: '#081020',
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 18,
  },
  brandBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBlock: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  menuList: {
    flex: 1,
    gap: 8,
    paddingTop: 10,
  },
  menuItem: {
    minHeight: 58,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuBadge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
});
