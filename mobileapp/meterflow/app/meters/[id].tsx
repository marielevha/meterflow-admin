import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { getClientMeterDetail, type MobileMeter } from '@/lib/api/mobile-meters';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function MeterDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const params = useLocalSearchParams<{ id?: string }>();
  const { logout } = useMobileSession();
  const [meter, setMeter] = useState<MobileMeter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!params.id) {
        setError('Identifiant du compteur manquant.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getClientMeterDetail(params.id);
        if (!active) return;
        setMeter(result.meter);
      } catch (loadError) {
        if (!active) return;
        const message = toMobileErrorMessage(loadError, 'Impossible de charger le compteur.');
        setError(message);
        if (isMobileAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [logout, params.id]);

  const latestState = meter?.states[0] ?? null;

  return (
    <RequireMobileAuth>
      <AppPage title="Détail compteur" subtitle="Mes compteurs" topBarMode="back" backHref="/meters">
        {loading ? (
          <StateCard text="Chargement du compteur..." color={palette.muted} loading palette={palette} />
        ) : error ? (
          <StateCard text={error} color={palette.danger} palette={palette} />
        ) : !meter ? (
          <StateCard text="Compteur introuvable." color={palette.muted} palette={palette} />
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.heroRow}>
                <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="flash-outline" size={22} color={palette.accent} />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={[styles.heroTitle, { color: palette.headline }]}>{meter.serialNumber}</Text>
                  <Text style={[styles.heroMeta, { color: palette.muted }]}>
                    {meter.meterReference || 'Référence non renseignée'}
                  </Text>
                </View>
              </View>

              <View style={styles.statusChipRow}>
                <View style={[styles.statusChip, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.statusChipText, { color: palette.primary }]}>{meter.status}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: palette.surfaceMuted }]}>
                  <Text style={[styles.statusChipText, { color: palette.headline }]}>{meter.type}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Informations</Text>
              <View style={styles.infoGrid}>
                <InfoItem
                  label="Ville / zone"
                  value={[meter.city, meter.zone].filter(Boolean).join(' / ') || '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Adresse"
                  value={[meter.addressLine1, meter.addressLine2].filter(Boolean).join(', ') || '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Installé le"
                  value={meter.installedAt ? formatDisplayDate(meter.installedAt) : '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Dernière inspection"
                  value={meter.lastInspectionAt ? formatDisplayDate(meter.lastInspectionAt) : '--'}
                  palette={palette}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Dernier état connu</Text>
              <View style={styles.infoGrid}>
                <InfoItem
                  label="Index principal"
                  value={latestState?.currentPrimary?.toString() ?? '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Index secondaire"
                  value={latestState?.currentSecondary?.toString() ?? '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Date effective"
                  value={latestState?.effectiveAt ? formatDisplayDate(latestState.effectiveAt) : '--'}
                  palette={palette}
                />
                <InfoItem
                  label="Agent affecté"
                  value={formatAssignedAgent(meter)}
                  palette={palette}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Coordonnées techniques</Text>
              <View style={styles.infoGrid}>
                <InfoItem label="Latitude" value={meter.latitude?.toString() ?? '--'} palette={palette} />
                <InfoItem label="Longitude" value={meter.longitude?.toString() ?? '--'} palette={palette} />
                <InfoItem label="Créé le" value={formatDisplayDate(meter.createdAt)} palette={palette} />
                <InfoItem label="Mis à jour" value={formatDisplayDate(meter.updatedAt)} palette={palette} />
              </View>
            </View>
          </>
        )}
      </AppPage>
    </RequireMobileAuth>
  );
}

function StateCard({
  text,
  color,
  loading = false,
  palette,
}: {
  text: string;
  color: string;
  loading?: boolean;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.stateCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
      {loading ? <CircularLoading palette={palette} size={56} /> : null}
      <Text style={[styles.stateText, { color }]}>{text}</Text>
    </View>
  );
}

function InfoItem({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

function formatAssignedAgent(meter: MobileMeter) {
  if (!meter.assignedAgent) return '--';

  return (
    [meter.assignedAgent.firstName, meter.assignedAgent.lastName].filter(Boolean).join(' ') ||
    meter.assignedAgent.username ||
    meter.assignedAgent.phone ||
    '--'
  );
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 10,
    alignItems: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoGrid: {
    gap: 14,
  },
  infoItem: {
    gap: 5,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
