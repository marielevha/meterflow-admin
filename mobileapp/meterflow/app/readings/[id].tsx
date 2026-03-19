import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { API_BASE_URL } from '@/lib/api/config';
import { getClientReadingDetail, type MobileReadingDetail } from '@/lib/api/mobile-readings';
import {
  getClientReviewDecisionMessage,
  getClientReviewDecisionTitle,
  humanizeReadingStatus,
} from '@/lib/readings/review-reasons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ReadingDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const params = useLocalSearchParams<{ id?: string }>();
  const { session, logout } = useMobileSession();
  const [reading, setReading] = useState<MobileReadingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!params.id) {
        setError('Identifiant du relevé manquant.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getClientReadingDetail(params.id);
        if (!active) return;
        setReading(result.reading);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : 'Impossible de charger le détail.';
        setError(message);
        if (message.includes('Session invalide')) {
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

  return (
    <RequireMobileAuth>
      <AppPage
        title="Détail relevé"
        subtitle="Historique client"
        topBarMode="back"
        backHref="/readings-history">
        {loading ? (
          <StateCard text="Chargement du relevé..." color={palette.muted} loading palette={palette} />
        ) : error ? (
          <StateCard text={error} color={palette.danger} palette={palette} />
        ) : !reading ? (
          <StateCard text="Relevé introuvable." color={palette.muted} palette={palette} />
        ) : (
          <>
            {reading.status === 'VALIDATED' || reading.flagReason || reading.rejectionReason ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      reading.status === 'REJECTED'
                        ? '#fff0ef'
                        : reading.status === 'FLAGGED'
                          ? '#fff6e7'
                          : palette.surface,
                    borderColor:
                      reading.status === 'REJECTED'
                        ? '#efc0bb'
                        : reading.status === 'FLAGGED'
                          ? '#f3c98b'
                          : palette.border,
                  },
                ]}>
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>Décision agent</Text>
                <Text style={[styles.decisionTitle, { color: palette.headline }]}>
                  {getClientReviewDecisionTitle(reading.status, reading.flagReason || reading.rejectionReason)}
                </Text>
                <Text
                  style={[
                    styles.decisionMessage,
                    {
                      color:
                        reading.status === 'REJECTED'
                          ? '#8f443a'
                          : reading.status === 'FLAGGED'
                            ? '#9a6514'
                            : palette.muted,
                    },
                  ]}>
                  {getClientReviewDecisionMessage(reading.status, reading.flagReason || reading.rejectionReason)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.headline }]}>{reading.meter.serialNumber}</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                {reading.meter.city} / {reading.meter.zone}
              </Text>
              <View style={styles.infoRow}>
                <InfoItem label="Statut" value={humanizeReadingStatus(reading.status)} palette={palette} />
                <InfoItem label="Index" value={String(reading.primaryIndex ?? '--')} palette={palette} />
              </View>
              <View style={styles.infoRow}>
                <InfoItem label="Soumis le" value={formatDisplayDateTime(reading.readingAt)} palette={palette} />
                <InfoItem
                  label="Traité le"
                  value={reading.reviewedAt ? formatDisplayDateTime(reading.reviewedAt) : '--'}
                  palette={palette}
                />
              </View>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: gpsDistanceWarning(reading.gpsDistanceMeters)
                    ? '#fff4e8'
                    : palette.surface,
                  borderColor: gpsDistanceWarning(reading.gpsDistanceMeters) ? '#f3c98b' : palette.border,
                },
              ]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Contrôle GPS</Text>
              <View style={styles.gpsRow}>
                <View
                  style={[
                    styles.gpsIconWrap,
                    {
                      backgroundColor: gpsDistanceWarning(reading.gpsDistanceMeters)
                        ? '#ffffffb8'
                        : palette.accentSoft,
                    },
                  ]}>
                  <Ionicons
                    name={gpsDistanceWarning(reading.gpsDistanceMeters) ? 'warning-outline' : 'locate-outline'}
                    size={18}
                    color={gpsDistanceWarning(reading.gpsDistanceMeters) ? '#c77c11' : palette.accent}
                  />
                </View>
                <View style={styles.gpsBody}>
                  <Text style={[styles.gpsTitle, { color: palette.headline }]}>
                    {formatGpsDistance(reading.gpsDistanceMeters)}
                  </Text>
                  <Text
                    style={[
                      styles.gpsMeta,
                      { color: gpsDistanceWarning(reading.gpsDistanceMeters) ? '#9a6514' : palette.muted },
                    ]}>
                    {gpsDistanceMessage(reading.gpsDistanceMeters)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Événements</Text>
              <View style={styles.eventsStack}>
                {reading.events.map((event) => (
                  <View key={event.id} style={[styles.eventItem, { borderColor: palette.border }]}>
                    <Text style={[styles.eventType, { color: palette.headline }]}>{event.type}</Text>
                    <Text style={[styles.eventMeta, { color: palette.muted }]}>
                      {formatDisplayDateTime(event.createdAt)}
                    </Text>
                    <Text style={[styles.eventMeta, { color: palette.muted }]}>
                      {event.user?.username || event.user?.firstName || 'Système'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>Photo du relevé</Text>

              {reading.imageUrl ? (
                <Image
                  source={{
                    uri: `${API_BASE_URL}/api/v1/mobile/readings/${reading.id}/image`,
                    headers: session?.accessToken
                      ? {
                          Authorization: `Bearer ${session.accessToken}`,
                        }
                      : undefined,
                  }}
                  style={styles.readingImage}
                  contentFit="cover"
                  alt=""
                />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
                  <Ionicons name="image-outline" size={24} color={palette.icon} />
                  <Text style={[styles.imagePlaceholderText, { color: palette.muted }]}>
                    Aucune image disponible pour ce relevé.
                  </Text>
                </View>
              )}
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

function formatDisplayDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function gpsDistanceWarning(value: string | number | null) {
  const distance = toNullableNumber(value);
  return distance !== null && distance > 200;
}

function formatGpsDistance(value: string | number | null) {
  const distance = toNullableNumber(value);
  if (distance === null) return 'Distance non calculable';
  return `${Math.round(distance)} m du compteur`;
}

function gpsDistanceMessage(value: string | number | null) {
  const distance = toNullableNumber(value);
  if (distance === null) {
    return 'Les coordonnées nécessaires sont incomplètes.';
  }

  if (distance > 200) {
    return 'La prise de photo semble éloignée du compteur enregistré. Un contrôle est recommandé.';
  }

  return 'La position paraît cohérente avec le compteur enregistré.';
}

function toNullableNumber(value: string | number | null) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  readingImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
  },
  imagePlaceholder: {
    minHeight: 160,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  imagePlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    gap: 4,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gpsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBody: {
    flex: 1,
    gap: 4,
  },
  gpsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  gpsMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  decisionTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  decisionMessage: {
    fontSize: 14,
    lineHeight: 21,
  },
  eventsStack: {
    gap: 10,
  },
  eventItem: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '800',
  },
  eventMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
});
