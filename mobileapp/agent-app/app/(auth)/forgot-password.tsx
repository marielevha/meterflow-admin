import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestPasswordReset } from '@/lib/auth/agent-auth-api';
import { useAgentSession } from '@/providers/agent-session-provider';

export default function ForgotPasswordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { isAuthenticated, isReady } = useAgentSession();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSubmit() {
    if (!phone.trim()) {
      setError('Saisissez votre numero de telephone.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await requestPasswordReset({ phone: phone.trim() });
      router.push({
        pathname: '/(auth)/reset-password',
        params: {
          phone: phone.trim(),
          debugCode: result.otp?.code ?? '',
        },
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Envoi du code impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Mot de passe oublie" subtitle="Recevez un code de reinitialisation" showBack>
      <AuthInput
        label="Telephone"
        icon="key-outline"
        placeholder="Saisissez votre numero"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton label="Envoyer le code" onPress={() => void handleSubmit()} loading={submitting} />

      <AuthFooterLink
        label="Vous vous souvenez de votre mot de passe ?"
        actionLabel="Retour connexion"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
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
