import { router } from 'expo-router';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { useI18n } from '@/hooks/use-i18n';

export default function ForgotPasswordScreen() {
  const { t } = useI18n();

  return (
    <AuthLayout
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}>
      <AuthInput
        label={t('auth.forgotPassword.identifierLabel')}
        icon="key-outline"
        placeholder={t('auth.forgotPassword.identifierPlaceholder')}
        autoCapitalize="none"
      />

      <AuthPrimaryButton
        label={t('auth.forgotPassword.submit')}
        onPress={() => router.push('/(auth)/reset-password')}
      />

      <AuthFooterLink
        label={t('auth.forgotPassword.footerLabel')}
        actionLabel={t('auth.forgotPassword.footerAction')}
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}
