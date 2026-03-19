import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { ThemeModeSwitcher } from '@/components/app/theme-mode-switcher';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMobileAppConfig, type MobileAppConfig } from '@/lib/api/mobile-app-config';
import { resetOnboardingCompleted } from '@/lib/storage/onboarding';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { logout } = useMobileSession();
  const { preferences, updatePreferences } = useMobilePreferences();
  const [appConfig, setAppConfig] = useState<MobileAppConfig | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const result = await getMobileAppConfig();
        if (!active) return;
        setAppConfig(result.config);
      } catch {
        if (!active) return;
        setAppConfig(null);
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  async function handleReplayOnboarding() {
    await resetOnboardingCompleted();
    router.replace('/onboarding');
  }

  return (
    <RequireMobileAuth>
      <AppPage title="Parametres" subtitle="Drawer menu" topBarMode="back" backHref="/(tabs)">
        <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>Apparence</Text>
            <Text style={[styles.cardText, { color: palette.muted }]}>
              Choisissez votre mode avec les icônes ci-dessous.
            </Text>
            <ThemeModeSwitcher />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>Préférences</Text>
            <SettingToggleRow
              label="Rester connecté"
              description="Conserver votre session sur cet appareil."
              value={preferences.keepSession}
              onValueChange={(value) => void updatePreferences({ keepSession: value })}
              palette={palette}
            />
            <SettingToggleRow
              label="Afficher l'aide caméra"
              description="Afficher le bouton d'information sur l'écran de prise de photo."
              value={preferences.showCameraHelp}
              onValueChange={(value) => void updatePreferences({ showCameraHelp: value })}
              palette={palette}
              last
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>Règles de relevé</Text>
            <InfoRow
              label="GPS requis"
              value={appConfig ? (appConfig.requireGpsForReading ? 'Oui' : 'Non') : '--'}
              palette={palette}
            />
            <InfoRow
              label="Seuil GPS"
              value={appConfig ? `${appConfig.maxGpsDistanceMeters} m` : '--'}
              palette={palette}
            />
            <InfoRow
              label="Taille max photo"
              value={appConfig ? `${appConfig.maxImageSizeMb} MB` : '--'}
              palette={palette}
              last
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.headline }]}>Actions</Text>

            <Pressable
              onPress={() => void handleReplayOnboarding()}
              style={[styles.actionButton, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Text style={[styles.actionButtonLabel, { color: palette.headline }]}>Revoir l&apos;onboarding</Text>
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
              <Text style={[styles.actionButtonDanger, { color: palette.danger }]}>Se déconnecter</Text>
            </Pressable>
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
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

const styles = StyleSheet.create({
  container: { gap: 22 },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 14 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardText: { fontSize: 14, lineHeight: 21 },
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
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonDanger: {
    fontSize: 15,
    fontWeight: '800',
  },
});
