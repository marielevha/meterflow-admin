import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import {
  checkUsernameWithBackend,
  generateUsernameWithBackend,
  registerWithBackend,
} from '@/lib/auth/mobile-auth-api';
import {
  markRegisterGuidanceSeen,
  shouldShowRegisterGuidance,
} from '@/lib/storage/register-guidance';
import { useMobileSession } from '@/providers/mobile-session-provider';

type UsernameState = 'idle' | 'generating' | 'generated' | 'checking' | 'available' | 'taken' | 'invalid';

export default function RegisterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const { isAuthenticated, isReady } = useMobileSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterGuidance, setShowRegisterGuidance] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [usernameMessage, setUsernameMessage] = useState<string>(() =>
    t('auth.register.username.idle')
  );
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null);
  const [usernameEditedManually, setUsernameEditedManually] = useState(false);
  const usernameRequestIdRef = useRef(0);

  const normalizedPhone = phone.trim();
  const passwordLengthValid = password.trim().length >= 8;
  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword;
  const hasNames = firstName.trim().length > 0 && lastName.trim().length > 0;
  const usernameIsStable =
    username.trim().length === 0 ||
    usernameState === 'generated' ||
    usernameState === 'available';
  const canSubmit =
    normalizedPhone.length > 0 &&
    passwordLengthValid &&
    passwordMatch &&
    usernameState !== 'generating' &&
    usernameState !== 'checking' &&
    usernameIsStable &&
    !submitting;

  const helperItems = useMemo(
    () => [
      {
        icon: 'call-outline' as const,
        label: t('auth.register.helper.phoneRequired'),
        ready: normalizedPhone.length > 0,
      },
      {
        icon: 'at-outline' as const,
        label: t('auth.register.helper.usernameVerified'),
        ready: usernameIsStable && username.trim().length > 0,
      },
      {
        icon: 'lock-closed-outline' as const,
        label: t('auth.register.helper.passwordMin'),
        ready: passwordLengthValid,
      },
      {
        icon: 'checkmark-circle-outline' as const,
        label: t('auth.register.helper.passwordMatch'),
        ready: passwordMatch,
      },
    ],
    [normalizedPhone.length, passwordLengthValid, passwordMatch, t, username, usernameIsStable]
  );
  const shouldShowUsernameMeta =
    showRegisterGuidance || usernameState !== 'idle' || !!usernameSuggestion;

  useEffect(() => {
    let active = true;

    void shouldShowRegisterGuidance().then((shouldShow) => {
      if (!active) return;
      setShowRegisterGuidance(shouldShow);
      if (shouldShow) {
        void markRegisterGuidanceSeen();
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (usernameEditedManually) {
      return;
    }

    if (!hasNames) {
      setUsername('');
      setUsernameState('idle');
      setUsernameSuggestion(null);
      setUsernameMessage(t('auth.register.username.waitingNames'));
      return;
    }

    const requestId = ++usernameRequestIdRef.current;
    setUsernameState('generating');
    setUsernameSuggestion(null);
    setUsernameMessage(t('auth.register.username.generating'));

    void generateUsernameWithBackend({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    })
      .then((result) => {
        if (requestId !== usernameRequestIdRef.current) return;
        setUsername(result.username);
        setUsernameState('generated');
        setUsernameMessage(t('auth.register.username.generated', { username: result.username }));
      })
      .catch((generationError) => {
        if (requestId !== usernameRequestIdRef.current) return;
        setUsernameState('invalid');
        setUsernameMessage(
          generationError instanceof Error
            ? generationError.message
            : t('auth.register.error.fixUsername')
        );
      });
  }, [firstName, hasNames, lastName, t, usernameEditedManually]);

  useEffect(() => {
    if (!usernameEditedManually) {
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername) {
      setUsernameState('idle');
      setUsernameSuggestion(null);
      setUsernameMessage(
        hasNames
          ? t('auth.register.username.emptyWithNames')
          : t('auth.register.username.emptyWithoutNames')
      );
      return;
    }

    setUsernameState('checking');
    setUsernameSuggestion(null);
    setUsernameMessage(t('auth.register.username.checking'));

    const timeout = setTimeout(() => {
      const requestId = ++usernameRequestIdRef.current;

      void checkUsernameWithBackend({ username: trimmedUsername })
        .then((result) => {
          if (requestId !== usernameRequestIdRef.current) return;

          setUsername(result.username);

          if (result.available) {
            setUsernameState('available');
            setUsernameMessage(t('auth.register.username.available'));
            setUsernameSuggestion(null);
          } else {
            setUsernameState('taken');
            setUsernameSuggestion(result.suggestion ?? null);
            setUsernameMessage(
              result.suggestion
                ? t('auth.register.username.takenWithSuggestion', { username: result.suggestion })
                : t('auth.register.username.taken')
            );
          }
        })
        .catch((checkError) => {
          if (requestId !== usernameRequestIdRef.current) return;
          setUsernameState('invalid');
          setUsernameSuggestion(null);
          setUsernameMessage(
            checkError instanceof Error
              ? checkError.message
              : t('auth.register.error.fixUsername')
          );
        });
    }, 350);

    return () => {
      clearTimeout(timeout);
    };
  }, [hasNames, t, username, usernameEditedManually]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleRegister() {
    if (!normalizedPhone || !password.trim()) {
      setError(t('auth.register.error.minRequired'));
      return;
    }

    if (!/^\+?[0-9]{8,20}$/.test(normalizedPhone)) {
      setError(t('auth.register.error.invalidPhone'));
      return;
    }

    if (!passwordLengthValid) {
      setError(t('auth.register.error.passwordTooShort'));
      return;
    }

    if (!passwordMatch) {
      setError(t('auth.register.error.passwordMismatch'));
      return;
    }

    if (usernameState === 'checking' || usernameState === 'generating') {
      setError(t('auth.register.error.waitUsernameCheck'));
      return;
    }

    if (!usernameIsStable) {
      setError(t('auth.register.error.fixUsername'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await registerWithBackend({
        firstName: normalizeOptional(firstName),
        lastName: normalizeOptional(lastName),
        username: normalizeOptional(username),
        email: normalizeOptional(email),
        phone: normalizedPhone,
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
      setError(
        registerError instanceof Error ? registerError.message : t('auth.register.error.submitFallback')
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleUsernameChange(value: string) {
    usernameRequestIdRef.current += 1;
    const normalized = value.toLowerCase();
    setUsernameEditedManually(true);
    setUsername(normalized);
    setUsernameSuggestion(null);
    setError(null);
  }

  function handleUseSuggestion(nextUsername: string) {
    setUsernameEditedManually(true);
    setUsername(nextUsername);
    setUsernameSuggestion(null);
    setError(null);
  }

  function handleRegenerateUsername() {
    usernameRequestIdRef.current += 1;
    setUsernameEditedManually(false);
    setUsernameSuggestion(null);
    setError(null);
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}>
      {showRegisterGuidance ? (
        <View style={[styles.infoCard, { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}44` }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconWrap, { backgroundColor: `${palette.accent}18` }]}>
              <Ionicons name="sparkles-outline" size={16} color={palette.accent} />
            </View>
            <Text style={[styles.infoTitle, { color: palette.primary }]}>{t('auth.register.infoTitle')}</Text>
          </View>
          <Text style={[styles.infoText, { color: palette.primary }]}>
            {t('auth.register.infoText')}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('auth.register.identitySection')}</Text>
        <AuthInput
          label={t('profile.firstName')}
          icon="person-outline"
          placeholder={t('auth.register.firstNamePlaceholder')}
          value={firstName}
          onChangeText={setFirstName}
        />
        <AuthInput
          label={t('profile.lastName')}
          icon="person-outline"
          placeholder={t('auth.register.lastNamePlaceholder')}
          value={lastName}
          onChangeText={setLastName}
        />

        <View style={styles.usernameBlock}>
          <AuthInput
            label={t('profile.username')}
            icon="at-outline"
            placeholder={t('auth.register.usernamePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={handleUsernameChange}
            hint={showRegisterGuidance ? t('auth.register.usernameHint') : undefined}
          />

          {shouldShowUsernameMeta ? (
            <View style={styles.usernameMetaRow}>
              <View style={styles.usernameStatusRow}>
                <Ionicons
                  name={usernameTone(usernameState).icon}
                  size={15}
                  color={usernameTone(usernameState).color(palette)}
                />
                <Text style={[styles.usernameStatusText, { color: usernameTone(usernameState).color(palette) }]}>
                  {usernameMessage}
                </Text>
              </View>

              {hasNames ? (
                <Pressable onPress={handleRegenerateUsername} style={styles.regenerateButton}>
                  <Text style={[styles.regenerateButtonText, { color: palette.accent }]}>
                    {t('auth.register.username.regenerate')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {usernameSuggestion ? (
            <Pressable
              onPress={() => handleUseSuggestion(usernameSuggestion)}
              style={[styles.suggestionChip, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="sparkles-outline" size={14} color={palette.accent} />
              <Text style={[styles.suggestionText, { color: palette.primary }]}>
                {t('auth.register.username.useSuggestion', { username: usernameSuggestion })}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <AuthInput
          label={t('profile.email')}
          icon="mail-outline"
          placeholder={t('auth.register.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <AuthInput
          label={t('profile.phone')}
          icon="call-outline"
          placeholder={t('auth.register.phonePlaceholder')}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          hint={
            showRegisterGuidance
              ? t('auth.register.phoneHint')
              : undefined
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('auth.register.securitySection')}</Text>
        <AuthInput
          label={t('profile.newPassword')}
          icon="lock-closed-outline"
          placeholder={t('auth.register.passwordPlaceholder')}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <AuthInput
          label={t('profile.confirmPassword')}
          icon="checkmark-circle-outline"
          placeholder={t('auth.register.confirmPasswordPlaceholder')}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {showRegisterGuidance ? (
          <View style={[styles.checklistCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            {helperItems.map((item) => (
              <View key={item.label} style={styles.checklistRow}>
                <Ionicons
                  name={item.ready ? 'checkmark-circle' : item.icon}
                  size={16}
                  color={item.ready ? palette.success : palette.icon}
                />
                <Text
                  style={[
                    styles.checklistText,
                    { color: item.ready ? palette.headline : palette.muted },
                  ]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
        </View>
      ) : null}

      <AuthPrimaryButton
        label={t('auth.register.submit')}
        onPress={() => void handleRegister()}
        loading={submitting}
        disabled={!canSubmit}
      />

      <AuthFooterLink
        label={t('auth.register.footerLabel')}
        actionLabel={t('auth.register.footerAction')}
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthLayout>
  );
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function usernameTone(state: UsernameState) {
  switch (state) {
    case 'generated':
      return { icon: 'sparkles-outline' as const, color: (palette: (typeof Colors)['light']) => palette.accent };
    case 'available':
      return { icon: 'checkmark-circle' as const, color: (palette: (typeof Colors)['light']) => palette.success };
    case 'checking':
    case 'generating':
      return { icon: 'time-outline' as const, color: (palette: (typeof Colors)['light']) => palette.warning };
    case 'taken':
    case 'invalid':
      return { icon: 'alert-circle-outline' as const, color: (palette: (typeof Colors)['light']) => palette.danger };
    default:
      return { icon: 'information-circle-outline' as const, color: (palette: (typeof Colors)['light']) => palette.muted };
  }
}

const styles = StyleSheet.create({
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  usernameBlock: {
    gap: 8,
  },
  usernameMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  usernameStatusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  usernameStatusText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  regenerateButton: {
    paddingVertical: 2,
  },
  regenerateButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  suggestionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  checklistCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
