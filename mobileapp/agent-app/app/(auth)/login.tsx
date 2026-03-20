import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAgentSession } from '@/providers/agent-session-provider';

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { login, isLoading, isAuthenticated, isReady } = useAgentSession();
  const [identifier, setIdentifier] = useState('agent001');
  const [password, setPassword] = useState('ChangeMe@123');
  const [error, setError] = useState<string | null>(null);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleLogin() {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password.trim()) {
      setError('Renseignez votre identifiant et votre mot de passe.');
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
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible.');
    }
  }

  return (
    <AuthLayout title="Connexion agent" subtitle="Connectez-vous a votre espace terrain">
      <AuthInput
        label="Username"
        icon="person-outline"
        placeholder="Saisissez votre identifiant"
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
      />
      <AuthInput
        label="Mot de passe"
        icon="lock-closed-outline"
        placeholder="Votre mot de passe"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.inlineAction}>
        <Text style={[styles.inlineActionText, { color: palette.accent }]}>Mot de passe oublie ?</Text>
      </Pressable>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton label="Se connecter" onPress={handleLogin} loading={isLoading} />

      <AuthFooterLink
        label="Vous n'avez pas encore de compte ?"
        actionLabel="Creer un compte"
        onPress={() => router.push('/(auth)/register')}
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
