import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { confirmPasswordReset } from '@/lib/auth/agent-auth-api';
import { useAgentSession } from '@/providers/agent-session-provider';

export default function ResetPasswordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { isAuthenticated, isReady } = useAgentSession();
  const params = useLocalSearchParams<{ phone?: string | string[]; debugCode?: string | string[] }>();
  const phone = useMemo(() => normalizeParam(params.phone), [params.phone]);
  const debugCode = useMemo(() => normalizeParam(params.debugCode), [params.debugCode]);
  const [code, setCode] = useState(debugCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(debugCode ? `Code de demo : ${debugCode}` : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (debugCode) {
      setCode(debugCode);
      setInfoMessage(`Code de demo : ${debugCode}`);
    }
  }, [debugCode]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleReset() {
    if (!phone) {
      setError('Telephone manquant. Reprenez la demande de reinitialisation.');
      return;
    }

    if (!code.trim() || !newPassword.trim()) {
      setError('Saisissez le code et le nouveau mot de passe.');
      return;
    }

    if (newPassword.trim().length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await confirmPasswordReset({
        phone,
        code: code.trim(),
        newPassword,
      });
      router.replace('/(auth)/login');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Mise a jour impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Reinitialiser le mot de passe" subtitle="Entrez le code et votre nouveau mot de passe" showBack>
      <AuthInput
        label="Code OTP"
        icon="shield-checkmark-outline"
        placeholder="000000"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
      />
      <AuthInput
        label="Nouveau mot de passe"
        icon="lock-closed-outline"
        placeholder="Votre nouveau mot de passe"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <AuthInput
        label="Confirmer le mot de passe"
        icon="checkmark-circle-outline"
        placeholder="Confirmez le mot de passe"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {infoMessage ? (
        <View style={[styles.infoBox, { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}55` }]}> 
          <Text style={[styles.infoText, { color: palette.primary }]}>{infoMessage}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton label="Mettre a jour" onPress={() => void handleReset()} loading={submitting} />
    </AuthLayout>
  );
}

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

const styles = StyleSheet.create({
  infoBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
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
