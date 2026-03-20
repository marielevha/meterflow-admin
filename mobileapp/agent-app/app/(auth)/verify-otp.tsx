import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { activateAgentAccount, resendAgentSignupOtp } from '@/lib/auth/agent-auth-api';
import { useAgentSession } from '@/providers/agent-session-provider';

export default function VerifyOtpScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { isAuthenticated, isReady } = useAgentSession();
  const params = useLocalSearchParams<{ phone?: string | string[]; debugCode?: string | string[] }>();
  const phone = useMemo(() => normalizeParam(params.phone), [params.phone]);
  const debugCode = useMemo(() => normalizeParam(params.debugCode), [params.debugCode]);
  const [code, setCode] = useState(debugCode);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    debugCode ? `Code de demo : ${debugCode}` : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

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

  async function handleVerify() {
    if (!phone) {
      setError('Telephone manquant. Reprenez l inscription.');
      return;
    }

    if (!code.trim()) {
      setError('Saisissez le code OTP.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await activateAgentAccount({ phone, code: code.trim() });
      router.replace('/(auth)/login');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Verification impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!phone || resending) {
      return;
    }

    setResending(true);
    setError(null);

    try {
      const result = await resendAgentSignupOtp({ phone });
      const nextCode = result.otp?.code ?? '';
      setCode(nextCode);
      setInfoMessage(nextCode ? `Nouveau code de demo : ${nextCode}` : 'Un nouveau code a ete envoye.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Renvoi impossible.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout title="Verification OTP" subtitle="Saisissez le code recu pour activer le compte" showBack>
      <AuthInput
        label="Code OTP"
        icon="shield-outline"
        placeholder="000000"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
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

      <AuthPrimaryButton label="Verifier et continuer" onPress={() => void handleVerify()} loading={submitting} />
      <Pressable onPress={() => void handleResend()} disabled={resending} style={styles.inlineAction}>
        <Text style={[styles.inlineActionText, { color: palette.accent, opacity: resending ? 0.6 : 1 }]}>Renvoyer le code</Text>
      </Pressable>

      <AuthFooterLink
        label="Vous avez deja active le compte ?"
        actionLabel="Retour connexion"
        onPress={() => router.replace('/(auth)/login')}
      />
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
  inlineAction: {
    alignSelf: 'center',
  },
  inlineActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
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
