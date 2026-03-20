import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function VerifyOtpScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <AuthLayout title="Verification OTP" subtitle="Saisissez le code recu" showBack>
      <AuthInput
        label="Code OTP"
        icon="shield-outline"
        placeholder="000000"
        keyboardType="number-pad"
      />

      <AuthPrimaryButton label="Verifier et continuer" onPress={() => router.replace('/(auth)/login')} />
      <Pressable onPress={() => {}} style={styles.inlineAction}>
        <Text style={[styles.inlineActionText, { color: palette.accent }]}>Renvoyer le code</Text>
      </Pressable>

      <AuthFooterLink
        label="Vous avez deja active le compte ?"
        actionLabel="Retour connexion"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  inlineAction: {
    alignSelf: 'center',
  },
  inlineActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
