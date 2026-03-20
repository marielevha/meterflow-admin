import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerWithBackend } from '@/lib/auth/agent-auth-api';
import { useAgentSession } from '@/providers/agent-session-provider';

export default function RegisterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { isAuthenticated, isReady } = useAgentSession();
  const [firstName, setFirstName] = useState('Agent');
  const [lastName, setLastName] = useState('Demo');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleRegister() {
    if (!phone.trim() || !password.trim()) {
      setError('Renseignez au minimum le telephone et le mot de passe.');
      return;
    }

    if (password.trim().length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await registerWithBackend({
        firstName,
        lastName,
        username,
        email,
        phone,
        region,
        city,
        zone,
        password,
      });

      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: result.user.phone,
          debugCode: result.otp.code,
        },
      });
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Inscription impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Creer un compte agent" subtitle="Renseignez vos informations pour activer le compte" showBack>
      <AuthInput label="Prenom" icon="person-outline" placeholder="Votre prenom" value={firstName} onChangeText={setFirstName} />
      <AuthInput label="Nom" icon="person-outline" placeholder="Votre nom" value={lastName} onChangeText={setLastName} />
      <AuthInput
        label="Nom d'utilisateur"
        icon="at-outline"
        placeholder="Choisissez un username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <AuthInput
        label="Email"
        icon="mail-outline"
        placeholder="Saisissez votre email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <AuthInput
        label="Telephone"
        icon="call-outline"
        placeholder="Saisissez votre numero"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <AuthInput label="Region" icon="map-outline" placeholder="Votre region" value={region} onChangeText={setRegion} />
      <AuthInput label="Ville" icon="business-outline" placeholder="Votre ville" value={city} onChangeText={setCity} />
      <AuthInput label="Zone" icon="navigate-outline" placeholder="Votre zone" value={zone} onChangeText={setZone} />
      <AuthInput
        label="Mot de passe"
        icon="lock-closed-outline"
        placeholder="Choisissez un mot de passe"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <AuthInput
        label="Confirmer le mot de passe"
        icon="checkmark-circle-outline"
        placeholder="Confirmez le mot de passe"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton label="Creer mon compte" onPress={() => void handleRegister()} loading={submitting} />

      <AuthFooterLink
        label="Vous avez deja un compte ?"
        actionLabel="Se connecter"
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
