import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { ThemeModeSwitcher } from '@/components/app/theme-mode-switcher';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { getMobileAppConfig, type MobileAppConfig } from '@/lib/api/mobile-app-config';
import { resetOnboardingCompleted } from '@/lib/storage/onboarding';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';
import { useMobilePushDiagnostics } from '@/providers/mobile-push-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t, locale } = useI18n();
  const { logout } = useMobileSession();
  const { preferences, updatePreferences } = useMobilePreferences();
  const { diagnostics, isCheckingPush, refreshPushDiagnostics } = useMobilePushDiagnostics();
  const [appConfig, setAppConfig] = useState<MobileAppConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfig = useCallback(
    async (activeRef: { current: boolean } = { current: true }, options: { mode?: 'initial' | 'refresh' } = {}) => {
      const mode = options.mode ?? 'initial';
      if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        const result = await getMobileAppConfig();
        if (!activeRef.current) return;
        setAppConfig(result.config);
      } catch {
        if (!activeRef.current) return;
        if (mode === 'initial') {
          setAppConfig(null);
        }
      } finally {
        if (activeRef.current && mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const activeRef = { current: true };

    void loadConfig(activeRef);

    return () => {
      activeRef.current = false;
    };
  }, [loadConfig]);

  async function handleReplayOnboarding() {
    await resetOnboardingCompleted();
    router.replace('/onboarding');
  }

  const formatPushPermission = useCallback(
    (status: string) => {
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
    },
    [t]
  );

  const formatPushCheckTime = useCallback(
    (value: string | null) => {
      if (!value) return t('settings.pushUnknown');

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return t('settings.pushUnknown');
      }

      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    },
    [locale, t]
  );

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        topBarMode="back"
        backHref="/(tabs)"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              void Promise.all([
                loadConfig({ current: true }, { mode: 'refresh' }),
                refreshPushDiagnostics(),
              ])
            }
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }>
        <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.appearanceTitle')}</Text>
            <Text style={[styles.cardText, { color: palette.muted }]}>
              {t('settings.appearanceText')}
            </Text>
            <ThemeModeSwitcher />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.languageTitle')}</Text>
            <Text style={[styles.cardText, { color: palette.muted }]}>{t('settings.languageText')}</Text>
            <LanguageSwitcher
              value={preferences.language}
              onChange={(value) => void updatePreferences({ language: value })}
              palette={palette}
              t={t}
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.preferencesTitle')}</Text>
            <SettingToggleRow
              label={t('settings.keepSessionLabel')}
              description={t('settings.keepSessionDesc')}
              value={preferences.keepSession}
              onValueChange={(value) => void updatePreferences({ keepSession: value })}
              palette={palette}
            />
            <SettingToggleRow
              label={t('settings.showCameraHelpLabel')}
              description={t('settings.showCameraHelpDesc')}
              value={preferences.showCameraHelp}
              onValueChange={(value) => void updatePreferences({ showCameraHelp: value })}
              palette={palette}
              last
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.rulesTitle')}</Text>
            <InfoRow
              label={t('settings.gpsRequired')}
              value={appConfig ? (appConfig.requireGpsForReading ? t('common.yes') : t('common.no')) : '--'}
              palette={palette}
            />
            <InfoRow
              label={t('settings.gpsThreshold')}
              value={appConfig ? `${appConfig.maxGpsDistanceMeters} m` : '--'}
              palette={palette}
            />
            <InfoRow
              label={t('settings.maxPhotoSize')}
              value={appConfig ? `${appConfig.maxImageSizeMb} MB` : '--'}
              palette={palette}
              last
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>{t('settings.pushDiagnosticsTitle')}</Text>
            <Text style={[styles.cardText, { color: palette.muted }]}>
              {t('settings.pushDiagnosticsText')}
            </Text>
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

            <Pressable
              onPress={() => void handleReplayOnboarding()}
              style={[styles.actionButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Text style={[styles.actionButtonLabel, { color: palette.headline }]}>{t('settings.replayOnboarding')}</Text>
            </Pressable>

            <Pressable
              onPress={() => void logout()}
              style={[
                styles.actionButton,
                {
                  backgroundColor: `${palette.danger}14`,
                  borderColor: `${palette.danger}33`,
                },
              ]}>
              <Text style={[styles.actionButtonDanger, { color: palette.danger }]}>{t('settings.logout')}</Text>
            </Pressable>
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
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
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.languageOption,
              {
                backgroundColor: selected ? palette.accent : 'transparent',
              },
            ]}>
            <Text style={[styles.languageOptionCode, { color: selected ? '#ffffff' : palette.muted }]}>
              {option.toUpperCase()}
            </Text>
            <Text style={[styles.languageOptionLabel, { color: selected ? '#ffffff' : palette.headline }]}>
              {option === 'fr'
                ? t('common.french')
                : option === 'en'
                  ? t('common.english')
                  : t('common.lingala')}
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette.border, true: `${palette.accent}66` }}
        thumbColor={value ? palette.accent : palette.surface}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
  palette,
  last = false,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value}</Text>
    </View>
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
    <View style={[styles.diagnosticRow, !last && { borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.diagnosticLabel, { color: palette.muted }]}>{label}</Text>
      <Text
        style={[
          styles.diagnosticValue,
          { color: tone === 'danger' ? palette.danger : palette.headline },
        ]}>
        {value}
      </Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 12,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardButtonSpacing: {
    marginTop: 4,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonDanger: {
    fontSize: 15,
    fontWeight: '800',
  },
  diagnosticRow: {
    gap: 6,
    paddingBottom: 12,
  },
  diagnosticLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  diagnosticValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
