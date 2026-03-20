import { router } from 'expo-router';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';

export default function RegisterScreen() {
  return (
    <AuthLayout title="Creer un compte" subtitle="Renseignez vos informations" showBack>
      <AuthInput label="Nom complet" icon="person-outline" placeholder="Votre nom complet" />
      <AuthInput
        label="Nom d'utilisateur"
        icon="at-outline"
        placeholder="Choisissez un username"
        autoCapitalize="none"
      />
      <AuthInput
        label="Email"
        icon="mail-outline"
        placeholder="Saisissez votre email"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <AuthInput
        label="Telephone"
        icon="call-outline"
        placeholder="Saisissez votre numero"
        keyboardType="phone-pad"
      />
      <AuthInput
        label="Mot de passe"
        icon="lock-closed-outline"
        placeholder="Choisissez un mot de passe"
        secureTextEntry
      />
      <AuthInput
        label="Confirmer le mot de passe"
        icon="checkmark-circle-outline"
        placeholder="Confirmez le mot de passe"
        secureTextEntry
      />

      <AuthPrimaryButton label="Creer mon compte" onPress={() => router.push('/(auth)/verify-otp')} />

      <AuthFooterLink
        label="Vous avez deja un compte ?"
        actionLabel="Se connecter"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}
