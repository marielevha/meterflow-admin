import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppShell } from '@/components/app/app-shell';
import { BrandMark } from '@/components/app/brand-mark';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  showBack?: boolean;
}>;

export function AuthLayout({
  title,
  subtitle,
  showBack = false,
  children,
}: AuthLayoutProps) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { width, height } = useWindowDimensions();
  const compactHeight = height < 760;
  const compactWidth = width < 370;
  const contentWidth = Math.min(width - 32, 420);
  const topGap = compactHeight ? 14 : 20;
  const blockGap = compactHeight ? 18 : 24;
  const cardPadding = compactWidth ? 18 : 22;
  const titleSize = compactWidth ? 22 : 26;
  const titleLineHeight = compactWidth ? 28 : 32;
  const subtitleSize = compactWidth ? 13 : 14;
  const brandSize = compactWidth ? 20 : 22;
  const logoSize = compactWidth ? 50 : 56;

  return (
    <AppShell>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.page,
            {
              paddingHorizontal: 16,
              paddingTop: topGap,
              paddingBottom: compactHeight ? 32 : 42,
              minHeight: height,
            },
          ]}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              style={[
                styles.backButton,
                { backgroundColor: palette.surface, borderColor: palette.border, top: topGap + 6 },
              ]}>
              <Ionicons name="arrow-back" size={18} color={palette.headline} />
            </Pressable>
          ) : null}

          <View style={[styles.contentStack, { gap: blockGap }]}>
            <View style={[styles.hero, { width: contentWidth }]}>
              <View style={styles.logoBlock}>
                <View style={[styles.logo, { width: logoSize, height: logoSize }]}>
                  <BrandMark
                    size={logoSize}
                    backgroundColor={palette.accentSoft}
                    primaryColor={palette.headline}
                    shadowColor={`${palette.accent}66`}
                    shadowColorAlt={`${palette.accent}40`}
                    accentColor={palette.accent}
                  />
                </View>
                <Text style={[styles.brand, { color: palette.headline, fontSize: brandSize }]}>
                  E2C Client
                </Text>
              </View>
            </View>

            <View style={[styles.header, { width: contentWidth }]}>
              <Text
                style={[
                  styles.title,
                  {
                    color: palette.headline,
                    fontSize: titleSize,
                    lineHeight: titleLineHeight,
                  },
                ]}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    styles.description,
                    {
                      color: palette.muted,
                      fontSize: subtitleSize,
                      lineHeight: compactWidth ? 20 : 22,
                      maxWidth: contentWidth - 18,
                    },
                  ]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.card,
                {
                  width: contentWidth,
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: compactWidth ? 22 : 24,
                  padding: cardPadding,
                },
              ]}>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    alignItems: 'center',
  },
  contentStack: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: {
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 22,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    gap: 16,
  },
});
