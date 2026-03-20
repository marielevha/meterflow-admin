import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { toMobileErrorMessage, isMobileAuthError } from '@/lib/api/mobile-client';
import {
  changeMobilePassword,
  getMobileProfile,
  updateMobileProfile,
  type MobileProfileSummary,
  type MobileProfileUser,
} from '@/lib/api/mobile-profile';
import { useMobileSession } from '@/providers/mobile-session-provider';

type ProfileFormState = {
  firstName: string;
  lastName: string;
  region: string;
  city: string;
  zone: string;
};

const EMPTY_FORM: ProfileFormState = {
  firstName: '',
  lastName: '',
  region: '',
  city: '',
  zone: '',
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { logout, updateSessionUser } = useMobileSession();
  const [profile, setProfile] = useState<MobileProfileUser | null>(null);
  const [summary, setSummary] = useState<MobileProfileSummary | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM);

  const hydrateForm = useCallback((user: MobileProfileUser) => {
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      region: user.region ?? '',
      city: user.city ?? '',
      zone: user.zone ?? '',
    });
  }, []);

  const loadProfile = useCallback(
    async (activeRef: { current: boolean } = { current: true }) => {
      setLoading(true);
      setError(null);

      try {
        const result = await getMobileProfile();
        if (!activeRef.current) return;
        setProfile(result.user);
        setSummary(result.summary);
        hydrateForm(result.user);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toMobileErrorMessage(loadError, t('profile.unavailableFallback'));
        setError(message);
        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          setLoading(false);
        }
      }
    },
    [hydrateForm, logout, t]
  );

  useEffect(() => {
    const activeRef = { current: true };
    void loadProfile(activeRef);

    return () => {
      activeRef.current = false;
    };
  }, [loadProfile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;

    return (
      normalizeField(form.firstName) !== (profile.firstName ?? '') ||
      normalizeField(form.lastName) !== (profile.lastName ?? '') ||
      normalizeField(form.region) !== (profile.region ?? '') ||
      normalizeField(form.city) !== (profile.city ?? '') ||
      normalizeField(form.zone) !== (profile.zone ?? '')
    );
  }, [form, profile]);

  const canSubmitPassword = useMemo(() => {
    return (
      passwordForm.currentPassword.trim().length > 0 &&
      passwordForm.newPassword.trim().length >= 8 &&
      passwordForm.confirmPassword.trim().length > 0 &&
      !passwordSaving
    );
  }, [passwordForm, passwordSaving]);

  async function handleSaveProfile() {
    if (!profile || saving || !hasChanges) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await updateMobileProfile({
        firstName: normalizeField(form.firstName) || null,
        lastName: normalizeField(form.lastName) || null,
        region: normalizeField(form.region) || null,
        city: normalizeField(form.city) || null,
        zone: normalizeField(form.zone) || null,
      });

      setProfile(result.user);
      hydrateForm(result.user);
      setEditing(false);
      setSuccessMessage(t('profile.updatedSuccess'));
      await updateSessionUser(result.user);
    } catch (saveError) {
      const message = toMobileErrorMessage(saveError, t('profile.unavailableFallback'));
      setError(message);
      if (isMobileAuthError(saveError)) {
        await logout();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (!profile) {
      setEditing(false);
      return;
    }

    hydrateForm(profile);
    setEditing(false);
    setError(null);
    setSuccessMessage(null);
  }

  async function handleChangePassword() {
    if (!canSubmitPassword) {
      return;
    }

    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError(t('profile.passwordDifferent'));
      return;
    }

    setPasswordSaving(true);

    try {
      await changeMobilePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm(EMPTY_PASSWORD_FORM);

      Alert.alert(
        t('profile.passwordUpdatedTitle'),
        t('profile.passwordUpdatedBody'),
        [
          {
            text: 'OK',
            onPress: () => {
              void logout();
            },
          },
        ]
      );
    } catch (changePasswordError) {
      const message = toMobileErrorMessage(
        changePasswordError,
        t('profile.passwordUpdateFallback')
      );
      setPasswordError(message);
      if (isMobileAuthError(changePasswordError)) {
        await logout();
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <RequireMobileAuth>
      <AppPage title={t('common.profile')} subtitle={t('profile.subtitle')} topBarMode="back" backHref="/(tabs)">
        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error && !profile ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('profile.unavailableTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadProfile()}
          />
        ) : !profile ? (
          <AppStateCard
            palette={palette}
            icon="person-circle-outline"
            title={t('profile.notFoundTitle')}
            description={t('profile.notFoundDescription')}
          />
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.heroTop}>
                <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.avatarText, { color: palette.primary }]}>
                    {getInitials(profile.firstName, profile.lastName, profile.username)}
                  </Text>
                </View>

                <View style={styles.heroBody}>
                  <View style={styles.heroTitleRow}>
                    <Text style={[styles.heroName, { color: palette.headline }]}>
                      {getDisplayName(profile)}
                    </Text>
                    <View style={[styles.statusPill, statusPillStyle(profile.status, palette)]}>
                      <Text style={[styles.statusPillText, statusPillTextStyle(profile.status, palette)]}>
                        {humanizeStatus(profile.status, t)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.heroMeta, { color: palette.muted }]}>
                    {profile.phone || profile.email || profile.username || t('profile.subtitle')}
                  </Text>
                  <Text style={[styles.heroMeta, { color: palette.muted }]}>
                    {t('profile.memberSince', { date: formatDate(profile.createdAt, locale) })}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryMetric
                  label={t('profile.meters')}
                  value={String(summary?.meterCount ?? 0)}
                  palette={palette}
                />
                <SummaryMetric
                  label={t('profile.readings')}
                  value={String(summary?.readingCount ?? 0)}
                  palette={palette}
                />
              </View>
            </View>

            {error ? (
              <View style={[styles.messageCard, { backgroundColor: '#fff0ef', borderColor: '#efc0bb' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
                <Text style={[styles.messageText, { color: palette.danger }]}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View
                style={[
                  styles.messageCard,
                  { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}55` },
                ]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={palette.accent} />
                <Text style={[styles.messageText, { color: palette.primary }]}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderMain}>
                  <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('profile.personalInfo')}</Text>
                </View>

                {!editing ? (
                  <Pressable
                    onPress={() => {
                      setEditing(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    style={[styles.inlineActionButton, { backgroundColor: palette.accentSoft }]}>
                    <Ionicons name="create-outline" size={14} color={palette.accent} />
                    <Text style={[styles.inlineActionText, { color: palette.primary }]}>{t('profile.edit')}</Text>
                  </Pressable>
                ) : null}
              </View>

              {editing ? (
                <View style={styles.formStack}>
                  <AuthInput
                    label={t('profile.firstName')}
                    icon="person-outline"
                    value={form.firstName}
                    onChangeText={(value) => setForm((current) => ({ ...current, firstName: value }))}
                    placeholder={t('profile.firstName')}
                  />
                  <AuthInput
                    label={t('profile.lastName')}
                    icon="person-outline"
                    value={form.lastName}
                    onChangeText={(value) => setForm((current) => ({ ...current, lastName: value }))}
                    placeholder={t('profile.lastName')}
                  />
                  <AuthInput
                    label={t('profile.region')}
                    icon="map-outline"
                    value={form.region}
                    onChangeText={(value) => setForm((current) => ({ ...current, region: value }))}
                    placeholder={t('profile.region')}
                  />
                  <AuthInput
                    label={t('profile.city')}
                    icon="business-outline"
                    value={form.city}
                    onChangeText={(value) => setForm((current) => ({ ...current, city: value }))}
                    placeholder={t('profile.city')}
                  />
                  <AuthInput
                    label={t('profile.zone')}
                    icon="navigate-outline"
                    value={form.zone}
                    onChangeText={(value) => setForm((current) => ({ ...current, zone: value }))}
                    placeholder={t('profile.zone')}
                  />

                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={handleCancelEdit}
                      disabled={saving}
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: palette.surfaceMuted,
                          borderColor: palette.border,
                          opacity: saving ? 0.6 : 1,
                        },
                      ]}>
                      <Text style={[styles.secondaryButtonText, { color: palette.headline }]}>{t('profile.cancel')}</Text>
                    </Pressable>
                    <View style={styles.primaryActionWrap}>
                      <AuthPrimaryButton
                        label={t('profile.save')}
                        icon="checkmark-outline"
                        loading={saving}
                        disabled={!hasChanges}
                        onPress={() => void handleSaveProfile()}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <InfoRow label={t('profile.firstName')} value={profile.firstName} palette={palette} />
                  <InfoRow label={t('profile.lastName')} value={profile.lastName} palette={palette} emptyValueLabel={t('common.notProvided')} />
                  <InfoRow label={t('profile.region')} value={profile.region} palette={palette} emptyValueLabel={t('common.notProvided')} />
                  <InfoRow label={t('profile.city')} value={profile.city} palette={palette} emptyValueLabel={t('common.notProvided')} />
                  <InfoRow label={t('profile.zone')} value={profile.zone} palette={palette} emptyValueLabel={t('common.notProvided')} />
                </View>
              )}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('profile.connectionInfo')}</Text>
              <View style={styles.infoGrid}>
                <InfoRow label={t('profile.phone')} value={profile.phone} palette={palette} emptyValueLabel={t('common.notProvided')} />
                <InfoRow label={t('profile.email')} value={profile.email} palette={palette} emptyValueLabel={t('common.notProvided')} />
                <InfoRow label={t('profile.username')} value={profile.username} palette={palette} emptyValueLabel={t('common.notProvided')} />
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('profile.security')}</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                {t('profile.securityText')}
              </Text>

              {passwordError ? (
                <View style={[styles.messageCard, { backgroundColor: '#fff0ef', borderColor: '#efc0bb' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
                  <Text style={[styles.messageText, { color: palette.danger }]}>{passwordError}</Text>
                </View>
              ) : null}

              <View style={styles.formStack}>
                <AuthInput
                  label={t('profile.currentPassword')}
                  icon="lock-closed-outline"
                  secureTextEntry
                  value={passwordForm.currentPassword}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: value }))
                  }
                  placeholder={t('profile.currentPasswordPlaceholder')}
                />
                <AuthInput
                  label={t('profile.newPassword')}
                  icon="shield-checkmark-outline"
                  secureTextEntry
                  value={passwordForm.newPassword}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({ ...current, newPassword: value }))
                  }
                  placeholder={t('profile.newPasswordPlaceholder')}
                  hint={t('profile.newPasswordHint')}
                />
                <AuthInput
                  label={t('profile.confirmPassword')}
                  icon="checkmark-circle-outline"
                  secureTextEntry
                  value={passwordForm.confirmPassword}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: value }))
                  }
                  placeholder={t('profile.confirmPasswordPlaceholder')}
                />

                <AuthPrimaryButton
                  label={t('profile.changePassword')}
                  icon="key-outline"
                  loading={passwordSaving}
                  disabled={!canSubmitPassword}
                  onPress={() => void handleChangePassword()}
                />
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('profile.accountSection')}</Text>
              <View style={styles.infoGrid}>
                <InfoRow label={t('profile.accountType')} value={humanizeRole(profile.role, t)} palette={palette} emptyValueLabel={t('common.notProvided')} />
                <InfoRow label={t('profile.accountStatus')} value={humanizeStatus(profile.status, t)} palette={palette} emptyValueLabel={t('common.notProvided')} />
                <InfoRow label={t('profile.activatedAt')} value={formatNullableDate(profile.activatedAt, locale, t)} palette={palette} emptyValueLabel={t('common.notProvided')} />
                <InfoRow label={t('profile.updatedAt')} value={formatDate(profile.updatedAt, locale)} palette={palette} emptyValueLabel={t('common.notProvided')} />
              </View>
            </View>
          </>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function SummaryMetric({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.summaryMetric, { borderColor: `${palette.border}a6` }]}>
      <Text style={[styles.summaryMetricValue, { color: palette.headline }]}>{value}</Text>
      <Text style={[styles.summaryMetricLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  palette,
  emptyValueLabel,
}: {
  label: string;
  value: string | null | undefined;
  palette: (typeof Colors)['light'];
  emptyValueLabel?: string;
}) {
  return (
    <View style={[styles.infoRow, { borderColor: `${palette.border}99` }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value?.trim() || emptyValueLabel || '—'}</Text>
    </View>
  );
}

function getDisplayName(profile: MobileProfileUser) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || 'Client';
}

function getInitials(firstName: string | null, lastName: string | null, username: string | null) {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase();
  if (initials) return initials;
  return (username?.[0] || 'C').toUpperCase();
}

function normalizeField(value: string) {
  return value.trim();
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatNullableDate(value: string | null, locale: string, t: (key: string) => string) {
  if (!value) return t('common.notProvided');
  return formatDate(value, locale);
}

function humanizeStatus(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case 'ACTIVE':
      return t('common.status.active');
    case 'PENDING':
      return t('common.status.pending');
    case 'SUSPENDED':
      return t('common.status.suspended');
    case 'DISABLED':
      return t('common.status.disabled');
    default:
      return status || t('common.notProvided');
  }
}

function humanizeRole(role: string | null | undefined, t: (key: string) => string) {
  switch (role) {
    case 'CLIENT':
      return t('common.client');
    default:
      return role || t('common.account');
  }
}

function statusPillStyle(status: string | null | undefined, palette: (typeof Colors)['light']) {
  switch (status) {
    case 'ACTIVE':
      return {
        backgroundColor: palette.accentSoft,
        borderColor: `${palette.accent}55`,
      };
    case 'PENDING':
      return {
        backgroundColor: '#fff6e7',
        borderColor: '#f3c98b',
      };
    default:
      return {
        backgroundColor: palette.surfaceMuted,
        borderColor: palette.border,
      };
  }
}

function statusPillTextStyle(status: string | null | undefined, palette: (typeof Colors)['light']) {
  switch (status) {
    case 'ACTIVE':
      return { color: palette.primary };
    case 'PENDING':
      return { color: '#9a6514' };
    default:
      return { color: palette.headline };
  }
}

const styles = StyleSheet.create({
  loadingWrap: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
  },
  heroBody: {
    flex: 1,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    flexShrink: 1,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  summaryMetricValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  summaryMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderMain: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  inlineActionButton: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  inlineActionText: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '800',
  },
  formStack: {
    gap: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryActionWrap: {
    flex: 1,
  },
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
