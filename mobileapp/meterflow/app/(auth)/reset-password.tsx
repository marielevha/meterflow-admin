import { router } from 'expo-router';

import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { useI18n } from '@/hooks/use-i18n';

export default function ResetPasswordScreen() {
  const { t } = useI18n();

  return (
    <AuthLayout
      title={t('auth.resetPassword.title')}
      subtitle={t('auth.resetPassword.subtitle')}>
      <AuthInput
        label={t('auth.resetPassword.otpLabel')}
        icon="shield-checkmark-outline"
        placeholder={t('auth.resetPassword.otpPlaceholder')}
        keyboardType="number-pad"
      />
      <AuthInput
        label={t('auth.resetPassword.passwordLabel')}
        icon="lock-closed-outline"
        placeholder={t('auth.resetPassword.passwordPlaceholder')}
        secureTextEntry
      />
      <AuthInput
        label={t('auth.resetPassword.confirmPasswordLabel')}
        icon="checkmark-circle-outline"
        placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
        secureTextEntry
      />

      <AuthPrimaryButton
        label={t('auth.resetPassword.submit')}
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}
