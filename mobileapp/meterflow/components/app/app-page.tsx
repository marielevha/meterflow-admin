import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppShell } from '@/components/app/app-shell';
import { AppTopBar } from '@/components/navigation/app-topbar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppPageProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  topBarMode?: 'drawer' | 'back';
  backHref?:
    | '/consumption/[meterId]'
    | '/readings-history'
    | '/(tabs)/account'
    | '/(tabs)'
    | '/meters'
    | '/profile'
    | '/settings'
    | '/about';
  onBackPress?: () => void;
  scrollable?: boolean;
  contentStyle?: ViewStyle;
}>;

export function AppPage({
  title,
  subtitle,
  topBarMode = 'drawer',
  backHref,
  onBackPress,
  scrollable = true,
  contentStyle,
  children,
}: AppPageProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <AppShell>
      <View style={styles.wrapper}>
        <View
          style={[
            styles.topBarShell,
            {
              backgroundColor: palette.background,
              borderBottomColor: palette.border,
            },
          ]}>
          <AppTopBar
            title={title}
            mode={topBarMode}
            backHref={backHref}
            onBackPress={onBackPress}
          />
        </View>

        {scrollable ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.staticContent, contentStyle]}>{children}</View>
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  topBarShell: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 22,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 22,
  },
});
