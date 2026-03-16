import { router } from 'expo-router';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';

export default function ForgotPasswordScreen() {
  return (
    <AuthLayout title="Mot de passe oublie" subtitle="Recevez un code de reinitialisation" showBack>
      <AuthInput
        label="Email, telephone ou username"
        icon="key-outline"
        placeholder="Saisissez votre identifiant"
        autoCapitalize="none"
      />

      <AuthPrimaryButton
        label="Envoyer le code"
        onPress={() => router.push('/(auth)/reset-password')}
      />

      <AuthFooterLink
        label="Vous vous souvenez de votre mot de passe ?"
        actionLabel="Retour connexion"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}
