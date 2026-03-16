import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { AppPage } from '@/components/app/app-page';
import { BrandMark } from '@/components/app/brand-mark';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AboutScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <RequireMobileAuth>
      <AppPage title="A propos" subtitle="Drawer menu">
        <View style={styles.container}>
          <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.logoBox, { backgroundColor: palette.accentSoft }]}>
              <BrandMark
                size={56}
                backgroundColor={palette.accentSoft}
                primaryColor={palette.headline}
                shadowColor={`${palette.accent}66`}
                shadowColorAlt={`${palette.accent}40`}
                accentColor={palette.accent}
              />
            </View>
            <Text style={[styles.title, { color: palette.headline }]}>MeterFlow Mobile</Text>
            <Text style={[styles.text, { color: palette.muted }]}>
              L&apos;application client pour l&apos;auto-relevé, le suivi des compteurs et les notifications liées à votre consommation.
            </Text>
            <View style={[styles.versionBadge, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.versionLabel, { color: palette.primary }]}>Version {appVersion}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>Ce que permet l&apos;application</Text>

            <FeatureItem
              icon="camera-outline"
              title="Prendre un relevé"
              text="Capturez une photo du compteur et suivez ensuite l&apos;état de traitement de votre relevé."
              palette={palette}
            />
            <FeatureItem
              icon="flash-outline"
              title="Consulter vos compteurs"
              text="Retrouvez les informations essentielles de vos compteurs, leur localisation et leur dernier état connu."
              palette={palette}
            />
            <FeatureItem
              icon="time-outline"
              title="Suivre l&apos;historique"
              text="Accédez à la liste de vos relevés soumis et au détail de chaque traitement."
              palette={palette}
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>Informations produit</Text>

            <InfoRow label="Application" value="MeterFlow Mobile" palette={palette} />
            <InfoRow label="Version" value={appVersion} palette={palette} />
            <InfoRow label="Cible" value="Clients abonnés" palette={palette} />
            <InfoRow label="Fonction principale" value="Auto-relevé de compteur" palette={palette} />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>Pourquoi cette application</Text>
            <Text style={[styles.longText, { color: palette.muted }]}>
              MeterFlow Mobile a été conçue pour rendre la remontée des relevés plus simple, plus rapide et plus
              traçable. L&apos;objectif est de permettre aux clients de transmettre un relevé fiable, tout en améliorant
              le suivi centralisé et la transparence du processus.
            </Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={[styles.footerText, { color: palette.muted }]}>
              © 2026 MeterFlow. Propulsé par E2C.
            </Text>
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
  );
}

function FeatureItem({
  icon,
  title,
  text,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: palette.accentSoft }]}>
        <Ionicons name={icon} size={18} color={palette.accent} />
      </View>
      <View style={styles.featureTextBlock}>
        <Text style={[styles.featureTitle, { color: palette.headline }]}>{title}</Text>
        <Text style={[styles.featureText, { color: palette.muted }]}>{text}</Text>
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 22 },
  heroCard: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 14, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 16 },
  logoBox: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  text: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  versionBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextBlock: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  featureText: {
    fontSize: 13,
    lineHeight: 19,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  longText: {
    fontSize: 14,
    lineHeight: 22,
  },
  footerNote: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
