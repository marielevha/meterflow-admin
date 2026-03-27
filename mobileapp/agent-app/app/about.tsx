import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { BrandMark } from '@/components/app/brand-mark';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';

export default function AboutScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t } = useI18n();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <RequireAgentAuth>
      <AppPage title={t('common.about')} topBarMode="back" backHref="/(tabs)">
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
            <Text style={[styles.title, { color: palette.headline }]}>{t('about.appName')}</Text>
            <Text style={[styles.subtitle, { color: palette.primary }]}>{t('about.subtitle')}</Text>
            <Text style={[styles.text, { color: palette.muted }]}>{t('about.appDescription')}</Text>
            <View style={[styles.versionBadge, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.versionLabel, { color: palette.primary }]}>
                {t('common.version')} {appVersion}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('about.whatItDoes')}</Text>

            <FeatureItem
              icon="briefcase-outline"
              title={t('about.trackMissions')}
              text={t('about.trackMissionsText')}
              palette={palette}
            />
            <FeatureItem
              icon="camera-outline"
              title={t('about.sendFieldReport')}
              text={t('about.sendFieldReportText')}
              palette={palette}
            />
            <FeatureItem
              icon="notifications-outline"
              title={t('about.followNotifications')}
              text={t('about.followNotificationsText')}
              palette={palette}
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('about.productInfo')}</Text>

            <InfoRow label={t('about.appLabel')} value={t('about.appName')} palette={palette} />
            <InfoRow label={t('common.version')} value={appVersion} palette={palette} />
            <InfoRow label={t('about.targetLabel')} value={t('about.targetValue')} palette={palette} />
            <InfoRow
              label={t('about.mainFunctionLabel')}
              value={t('about.mainFunctionValue')}
              palette={palette}
            />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('about.whyTitle')}</Text>
            <Text style={[styles.longText, { color: palette.muted }]}>{t('about.whyText')}</Text>
          </View>

          <View style={styles.footerNote}>
            <Text style={[styles.footerText, { color: palette.muted }]}>{t('about.footer')}</Text>
          </View>
        </View>
      </AppPage>
    </RequireAgentAuth>
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
  container: {
    gap: 22,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
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
