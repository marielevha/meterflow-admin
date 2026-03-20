import { router } from 'expo-router';

import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';

export default function ResetPasswordScreen() {
  return (
    <AuthLayout title="Reinitialiser le mot de passe" subtitle="Entrez le code et votre nouveau mot de passe" showBack>
      <AuthInput
        label="Code OTP"
        icon="shield-checkmark-outline"
        placeholder="000000"
        keyboardType="number-pad"
      />
      <AuthInput
        label="Nouveau mot de passe"
        icon="lock-closed-outline"
        placeholder="Votre nouveau mot de passe"
        secureTextEntry
      />
      <AuthInput
        label="Confirmer le mot de passe"
        icon="checkmark-circle-outline"
        placeholder="Confirmez le mot de passe"
        secureTextEntry
      />

      <AuthPrimaryButton label="Mettre a jour" onPress={() => router.replace('/(auth)/login')} />
    </AuthLayout>
  );
}
