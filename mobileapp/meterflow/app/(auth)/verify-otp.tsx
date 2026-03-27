import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { activateClientAccount, resendClientSignupOtp } from '@/lib/auth/mobile-auth-api';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function VerifyOtpScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const { isAuthenticated, isReady } = useMobileSession();
  const params = useLocalSearchParams<{ phone?: string | string[]; debugCode?: string | string[] }>();
  const phone = useMemo(() => normalizeParam(params.phone), [params.phone]);
  const debugCode = useMemo(() => normalizeParam(params.debugCode), [params.debugCode]);
  const [code, setCode] = useState(debugCode);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    debugCode ? t('auth.verifyOtp.debugCode', { code: debugCode }) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (debugCode) {
      setCode(debugCode);
      setInfoMessage(t('auth.verifyOtp.debugCode', { code: debugCode }));
    }
  }, [debugCode, t]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleVerify() {
    if (!phone) {
      setError(t('auth.verifyOtp.error.phoneMissing'));
      return;
    }

    if (!code.trim()) {
      setError(t('auth.verifyOtp.error.codeRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await activateClientAccount({ phone, code: code.trim() });
      router.replace('/(auth)/login');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : t('auth.verifyOtp.error.verifyFallback'));
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
      const result = await resendClientSignupOtp({ phone });
      const nextCode = result.otp?.code ?? '';
      setCode(nextCode);
      setInfoMessage(
        nextCode
          ? t('auth.verifyOtp.newDebugCode', { code: nextCode })
          : t('auth.verifyOtp.resentSuccess')
      );
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t('auth.verifyOtp.error.resendFallback'));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.verifyOtp.title')}
      subtitle={t('auth.verifyOtp.subtitle')}>
      <View style={[styles.infoCard, { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}55` }]}>
        <Text style={[styles.infoCardTitle, { color: palette.primary }]}>{t('auth.verifyOtp.infoTitle')}</Text>
        <Text style={[styles.infoCardText, { color: palette.primary }]}>
          {phone
            ? t('auth.verifyOtp.infoWithPhone', { phone })
            : t('auth.verifyOtp.infoWithoutPhone')}
        </Text>
      </View>

      <AuthInput
        label={t('auth.verifyOtp.codeLabel')}
        icon="shield-outline"
        placeholder={t('auth.verifyOtp.codePlaceholder')}
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
      />

      {infoMessage ? (
        <View style={[styles.messageBox, { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}55` }]}>
          <Text style={[styles.messageText, { color: palette.primary }]}>{infoMessage}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton
        label={t('auth.verifyOtp.submit')}
        onPress={() => void handleVerify()}
        loading={submitting}
      />

      <Pressable onPress={() => void handleResend()} disabled={resending} style={styles.inlineAction}>
        <Text style={[styles.inlineActionText, { color: palette.accent, opacity: resending ? 0.6 : 1 }]}>
          {t('auth.verifyOtp.resend')}
        </Text>
      </Pressable>

      <AuthFooterLink
        label={t('auth.verifyOtp.footerLabel')}
        actionLabel={t('auth.verifyOtp.footerAction')}
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
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  infoCardText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageText: {
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
  inlineAction: {
    alignSelf: 'center',
  },
  inlineActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
