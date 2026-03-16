import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMobileSession } from '@/providers/mobile-session-provider';

const METERS = [
  {
    id: 'MF-SN-DKR-0006',
    label: 'Compteur principal',
    address: 'Dakar / Almadies',
    lastIndex: '501 kWh',
    lastReadingDate: '07 fev. 2026',
    status: 'Actif',
  },
  {
    id: 'MF-CG-BZV-0001',
    label: 'Compteur secondaire',
    address: 'Brazzaville / Makelele',
    lastIndex: '1328 kWh',
    lastReadingDate: '01 fev. 2026',
    status: 'Actif',
  },
];

const LAST_READING = {
  status: 'En cours de validation',
  meter: 'MF-SN-DKR-0006',
  index: '501 kWh',
  submittedAt: '07 fev. 2026 a 10:10',
};

const QUICK_INFO = [
  {
    title: 'Fenetre de releve',
    value: '20 -> 05',
    helper: 'Prochaine campagne ouverte',
    icon: 'calendar-outline' as const,
  },
  {
    title: 'Derniere facture',
    value: '12 500 FCFA',
    helper: 'Echeance le 28 fev.',
    icon: 'receipt-outline' as const,
  },
];

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { session } = useMobileSession();

  const customerName =
    [session?.user.firstName, session?.user.lastName].filter(Boolean).join(' ') || 'Client MeterFlow';

  return (
    <RequireMobileAuth>
      <AppPage title="Accueil" subtitle="Tableau client">
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>Bonjour</Text>
            <Text style={[styles.title, { color: palette.headline }]}>{customerName}</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Votre espace client pour les releves, compteurs et notifications.
            </Text>
          </View>

          <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.avatarText, { color: palette.primary }]}>
              {session?.user.firstName?.[0] || 'C'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(tabs)/readings')}
          style={[styles.heroCard, { backgroundColor: palette.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>Action principale</Text>
              <Text style={styles.heroTitle}>Faire un releve</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="camera-outline" size={24} color="#ffffff" />
            </View>
          </View>

          <Text style={styles.heroText}>
            Photographiez le compteur, saisissez l&apos;index et envoyez votre releve en quelques secondes.
          </Text>

          <View style={styles.heroFooter}>
            <Text style={styles.heroLink}>Commencer maintenant</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </View>
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.headline }]}>Mes compteurs</Text>
          <View style={styles.sectionStack}>
            {METERS.map((meter) => (
              <View
                key={meter.id}
                style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: palette.muted }]}>{meter.label}</Text>
                    <Text style={[styles.cardTitle, { color: palette.headline }]}>{meter.id}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: palette.accentSoft }]}>
                    <Text style={[styles.statusText, { color: palette.primary }]}>{meter.status}</Text>
                  </View>
                </View>

                <Text style={[styles.cardMeta, { color: palette.muted }]}>{meter.address}</Text>

                <View style={styles.metricsRow}>
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricLabel, { color: palette.muted }]}>Dernier index</Text>
                    <Text style={[styles.metricValue, { color: palette.headline }]}>{meter.lastIndex}</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricLabel, { color: palette.muted }]}>Date</Text>
                    <Text style={[styles.metricValue, { color: palette.headline }]}>{meter.lastReadingDate}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.headline }]}>Dernier releve</Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardLabel, { color: palette.muted }]}>Statut</Text>
                <Text style={[styles.cardTitle, { color: palette.headline }]}>{LAST_READING.status}</Text>
              </View>
              <Ionicons name="time-outline" size={22} color={palette.accent} />
            </View>

            <Text style={[styles.cardMeta, { color: palette.muted }]}>{LAST_READING.meter}</Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricBlock}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Index</Text>
                <Text style={[styles.metricValue, { color: palette.headline }]}>{LAST_READING.index}</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={[styles.metricLabel, { color: palette.muted }]}>Soumis le</Text>
                <Text style={[styles.metricValue, { color: palette.headline }]}>{LAST_READING.submittedAt}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.headline }]}>A retenir</Text>
          <View style={styles.infoGrid}>
            {QUICK_INFO.map((item) => (
              <View
                key={item.title}
                style={[styles.infoCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
                <View style={[styles.infoIcon, { backgroundColor: palette.surface }]}>
                  <Ionicons name={item.icon} size={18} color={palette.accent} />
                </View>
                <Text style={[styles.infoTitle, { color: palette.muted }]}>{item.title}</Text>
                <Text style={[styles.infoValue, { color: palette.headline }]}>{item.value}</Text>
                <Text style={[styles.infoHelper, { color: palette.muted }]}>{item.helper}</Text>
              </View>
            ))}
          </View>
        </View>
      </AppPage>
    </RequireMobileAuth>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 280,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroEyebrow: {
    color: '#c7d4ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    color: '#eaf0ff',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 290,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroLink: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionStack: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBlock: {
    flex: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  infoHelper: {
    fontSize: 12,
    lineHeight: 18,
  },
});
