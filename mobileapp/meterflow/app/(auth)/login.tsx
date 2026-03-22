import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const { login, isLoading, isAuthenticated } = useMobileSession();
  const [identifier, setIdentifier] = useState('client001');
  const [password, setPassword] = useState('ChangeMe@123');
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleLogin() {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password.trim()) {
      setError(t('auth.login.error.required'));
      return;
    }

    setError(null);

    try {
      await login({
        identifier: trimmedIdentifier,
        password,
      });
      router.replace('/(tabs)');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('auth.login.error.fallback'));
    }
  }

  return (
    <AuthLayout title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <AuthInput
        label={t('auth.login.identifierLabel')}
        icon="person-outline"
        placeholder={t('auth.login.identifierPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
      />
      <AuthInput
        label={t('auth.login.passwordLabel')}
        icon="lock-closed-outline"
        placeholder={t('auth.login.passwordPlaceholder')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.inlineAction}>
        <Text style={[styles.inlineActionText, { color: palette.accent }]}>{t('auth.login.forgotPassword')}</Text>
      </Pressable>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton label={t('auth.login.submit')} onPress={handleLogin} loading={isLoading} />

      <AuthFooterLink
        label={t('auth.login.footerLabel')}
        actionLabel={t('auth.login.footerAction')}
        onPress={() => router.replace('/(auth)/register')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  inlineAction: {
    alignSelf: 'flex-end',
    marginTop: -2,
  },
  inlineActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
