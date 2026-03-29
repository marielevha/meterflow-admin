import Constants from 'expo-constants';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AppPage } from '@/components/app/app-page';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { ThemeModeSwitcher } from '@/components/app/theme-mode-switcher';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { resetOnboardingCompleted } from '@/lib/storage/onboarding';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';
import { useMobilePushDiagnostics } from '@/providers/mobile-push-provider';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const { logout } = useAgentSession();
  const { preferences, updatePreferences } = useMobilePreferences();
  const { refreshUnreadCount } = useMobileNotifications();
  const { diagnostics, isCheckingPush, refreshPushDiagnostics } = useMobilePushDiagnostics();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  async function handleReplayOnboarding() {
    await resetOnboardingCompleted();
    router.replace('/onboarding');
  }

  function formatPushPermission(status: string) {
    switch (status) {
      case 'granted':
        return t('settings.pushPermissionGranted');
      case 'denied':
        return t('settings.pushPermissionDenied');
      case 'undetermined':
        return t('settings.pushPermissionUndetermined');
      default:
        return t('settings.pushUnknown');
    }
  }

  function formatPushCheckTime(value: string | null) {
    if (!value) return t('settings.pushUnknown');

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t('settings.pushUnknown');
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  return (
    <RequireAgentAuth>
      <AppPage title={t('settings.title')} topBarMode="back" backHref="/(tabs)">
        <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.appearanceTitle')}</Text>
          <Text style={[styles.cardText, { color: palette.muted }]}>{t('settings.appearanceText')}</Text>
          <ThemeModeSwitcher />
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.languageTitle')}</Text>
          <Text style={[styles.cardText, { color: palette.muted }]}>{t('settings.languageText')}</Text>
          <LanguageSwitcher value={preferences.language} onChange={(value) => void updatePreferences({ language: value })} palette={palette} t={t} />
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.preferencesTitle')}</Text>
          <SettingToggleRow
            label={t('settings.inAppNotifications')}
            description={t('settings.inAppNotificationsText')}
            value={preferences.notificationsEnabled}
            onValueChange={(value) => void updatePreferences({ notificationsEnabled: value })}
            palette={palette}
          />
          <SettingToggleRow
            label={t('settings.compactMode')}
            description={t('settings.compactModeText')}
            value={preferences.compactMode}
            onValueChange={(value) => void updatePreferences({ compactMode: value })}
            palette={palette}
            last
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.pushDiagnosticsTitle')}</Text>
          <Text style={[styles.cardText, { color: palette.muted }]}>{t('settings.pushDiagnosticsText')}</Text>
          <DiagnosticRow
            label={t('settings.pushPermission')}
            value={formatPushPermission(diagnostics.permissionStatus)}
            palette={palette}
          />
          <DiagnosticRow
            label={t('settings.pushPlatform')}
            value={diagnostics.platform.toUpperCase()}
            palette={palette}
          />
          <DiagnosticRow
            label={t('settings.pushAppVersion')}
            value={diagnostics.appVersion ?? t('settings.pushUnknown')}
            palette={palette}
          />
          <DiagnosticRow
            label={t('settings.pushDeviceToken')}
            value={diagnostics.tokenPreview ?? t('settings.pushTokenMissing')}
            palette={palette}
          />
          <DiagnosticRow
            label={t('settings.pushBackendRegistration')}
            value={diagnostics.backendRegistered ? t('common.yes') : t('common.no')}
            palette={palette}
          />
          <DiagnosticRow
            label={t('settings.pushLastCheck')}
            value={formatPushCheckTime(diagnostics.lastCheckedAt)}
            palette={palette}
            last={!diagnostics.lastError}
          />
          {diagnostics.lastError ? (
            <DiagnosticRow
              label={t('settings.pushLastError')}
              value={diagnostics.lastError}
              palette={palette}
              tone="danger"
              last
            />
          ) : null}

          <Pressable
            disabled={isCheckingPush}
            onPress={() => void refreshPushDiagnostics({ forceRegister: true })}
            style={[
              styles.actionButton,
              styles.cardButtonSpacing,
              {
                backgroundColor: isCheckingPush ? palette.surfaceMuted : `${palette.accent}14`,
                borderColor: isCheckingPush ? palette.border : `${palette.accent}33`,
              },
            ]}>
            <Text
              style={[
                styles.actionButtonLabel,
                {
                  color: isCheckingPush ? palette.muted : palette.accent,
                },
              ]}>
              {isCheckingPush ? t('settings.pushTesting') : t('settings.pushTestRegistration')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.actionsTitle')}</Text>

          <Pressable onPress={() => void handleReplayOnboarding()} style={[styles.actionButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.actionButtonLabel, { color: palette.headline }]}>{t('settings.replayOnboarding')}</Text>
          </Pressable>

          <Pressable onPress={() => void refreshUnreadCount()} style={[styles.actionButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.actionButtonLabel, { color: palette.headline }]}>{t('settings.refreshNotifications')}</Text>
          </Pressable>

          <Pressable onPress={() => void logout()} style={[styles.actionButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
            <Text style={[styles.actionButtonLabel, { color: palette.headline }]}>{t('common.logout')}</Text>
          </Pressable>

          <View style={[styles.versionPill, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.versionLabel, { color: palette.muted }]}>{t('common.version')}</Text>
            <Text style={[styles.versionValue, { color: palette.headline }]}>{version}</Text>
          </View>
        </View>
        </View>
      </AppPage>
    </RequireAgentAuth>
  );
}

function DiagnosticRow({
  label,
  value,
  palette,
  tone = 'default',
  last = false,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
  tone?: 'default' | 'danger';
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          {
            color: tone === 'danger' ? palette.danger : palette.headline,
          },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function LanguageSwitcher({
  value,
  onChange,
  palette,
  t,
}: {
  value: 'fr' | 'en' | 'ln';
  onChange: (value: 'fr' | 'en' | 'ln') => void;
  palette: (typeof Colors)['light'];
  t: (key: string) => string;
}) {
  return (
    <View style={[styles.languageSwitcher, { borderColor: palette.border, backgroundColor: palette.surfaceMuted }]}>
      {(['fr', 'en', 'ln'] as const).map((option) => {
        const selected = option === value;

        return (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.languageOption, { backgroundColor: selected ? palette.accent : 'transparent' }]}>
            <Text style={[styles.languageOptionCode, { color: selected ? '#ffffff' : palette.muted }]}>{option.toUpperCase()}</Text>
            <Text style={[styles.languageOptionLabel, { color: selected ? '#ffffff' : palette.headline }]}>
              {option === 'fr' ? t('common.french') : option === 'en' ? t('common.english') : t('common.lingala')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingToggleRow({
  label,
  description,
  value,
  onValueChange,
  palette,
  last = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  palette: (typeof Colors)['light'];
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
      <View style={styles.toggleTextBlock}>
        <Text style={[styles.toggleLabel, { color: palette.headline }]}>{label}</Text>
        <Text style={[styles.toggleDescription, { color: palette.muted }]}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: palette.border, true: `${palette.accent}66` }} thumbColor={value ? palette.accent : palette.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 22 },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 14 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardText: { fontSize: 14, lineHeight: 21 },
  languageSwitcher: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  languageOption: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  languageOptionCode: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  languageOptionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardButtonSpacing: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});
