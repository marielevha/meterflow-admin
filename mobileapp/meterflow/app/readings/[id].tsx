import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireMobileAuth } from '@/components/auth/require-mobile-auth';
import { Colors } from '@/constants/theme';
import { API_BASE_URL } from '@/lib/api/config';
import { isMobileAuthError, toMobileErrorMessage } from '@/lib/api/mobile-client';
import { getClientReadingDetail, type MobileReadingDetail } from '@/lib/api/mobile-readings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';
import { useMobileSession } from '@/providers/mobile-session-provider';

export default function ReadingDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { locale, t } = useI18n();
  const params = useLocalSearchParams<{ id?: string; notificationId?: string }>();
  const { session, logout } = useMobileSession();
  const { markNotificationsRead } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [reading, setReading] = useState<MobileReadingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notificationId =
    typeof params.notificationId === 'string' ? params.notificationId : null;

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!params.id) {
        setError(t('readingDetail.missingId'));
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
        const message = toMobileErrorMessage(loadError, t('readingDetail.fallback'));
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
  }, [logout, params.id, t]);

  useEffect(() => {
    if (!notificationId) {
      return;
    }

    void markNotificationsRead([notificationId]);
  }, [markNotificationsRead, notificationId]);

  return (
    <RequireMobileAuth>
      <AppPage
        title={t('readingDetail.title')}
        subtitle={t('readingDetail.subtitle')}
        topBarMode="back"
        backHref="/readings-history">
        {loading ? (
          <StateCard text={t('readingDetail.loading')} color={palette.muted} loading palette={palette} />
        ) : error ? (
          <StateCard text={error} color={palette.danger} palette={palette} />
        ) : !reading ? (
          <StateCard text={t('readingDetail.notFound')} color={palette.muted} palette={palette} />
        ) : (
          <>
            {reading.status !== 'PENDING' ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      reading.status === 'REJECTED'
                        ? '#fff0ef'
                        : reading.status === 'FLAGGED' || reading.status === 'RESUBMISSION_REQUESTED'
                          ? '#fff6e7'
                          : palette.surface,
                    borderColor:
                      reading.status === 'REJECTED'
                        ? '#efc0bb'
                        : reading.status === 'FLAGGED' || reading.status === 'RESUBMISSION_REQUESTED'
                          ? '#f3c98b'
                          : palette.border,
                  },
                ]}>
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('readingDetail.agentDecision')}</Text>
                <Text style={[styles.decisionTitle, { color: palette.headline }]}>
                  {reading.decisionTitle || reading.statusLabel || '--'}
                </Text>
                <Text
                  style={[
                    styles.decisionMessage,
                    {
                      color:
                        reading.status === 'REJECTED'
                          ? '#8f443a'
                          : reading.status === 'FLAGGED' || reading.status === 'RESUBMISSION_REQUESTED'
                            ? '#9a6514'
                            : palette.muted,
                    },
                  ]}>
                  {reading.decisionMessage || t('readingDetail.decisionFallback')}
                </Text>
                {reading.canResubmit ? (
                  <Pressable
                    onPress={() =>
                      safePush({
                        pathname: '/(tabs)/readings',
                        params: {
                          resubmitReadingId: reading.id,
                          meterId: reading.meterId,
                        },
                      })
                    }
                    style={[styles.resubmitButton, { backgroundColor: '#ffffffa8' }]}>
                    <Ionicons name="camera-outline" size={16} color={palette.primary} />
                    <Text style={[styles.resubmitButtonText, { color: palette.primary }]}>
                      {t('history.resubmit')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.headline }]}>{reading.meter.serialNumber}</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                {reading.meter.city} / {reading.meter.zone}
              </Text>
              <View style={styles.infoRow}>
                <InfoItem label={t('readingDetail.status')} value={reading.statusLabel || '--'} palette={palette} />
                <InfoItem label={t('common.index')} value={String(reading.primaryIndex ?? '--')} palette={palette} />
              </View>
              <View style={styles.infoRow}>
                <InfoItem label={t('readingDetail.submittedAt')} value={formatDisplayDateTime(reading.readingAt, locale)} palette={palette} />
                <InfoItem
                  label={t('readingDetail.reviewedAt')}
                  value={reading.reviewedAt ? formatDisplayDateTime(reading.reviewedAt, locale) : '--'}
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
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('readingDetail.gpsCheck')}</Text>
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
                    {formatGpsDistance(reading.gpsDistanceMeters, t)}
                  </Text>
                  <Text
                    style={[
                      styles.gpsMeta,
                      { color: gpsDistanceWarning(reading.gpsDistanceMeters) ? '#9a6514' : palette.muted },
                    ]}>
                    {gpsDistanceMessage(reading.gpsDistanceMeters, t)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('readingDetail.events')}</Text>
              <View style={styles.eventsStack}>
                {reading.events.map((event) => (
                  <View key={event.id} style={[styles.eventItem, { borderColor: palette.border }]}>
                    <Text style={[styles.eventType, { color: palette.headline }]}>{event.type}</Text>
                    <Text style={[styles.eventMeta, { color: palette.muted }]}>
                      {formatDisplayDateTime(event.createdAt, locale)}
                    </Text>
                    <Text style={[styles.eventMeta, { color: palette.muted }]}>
                      {event.user?.username || event.user?.firstName || t('common.system')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('readingDetail.photoTitle')}</Text>

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
                    {t('readingDetail.photoUnavailable')}
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

function formatDisplayDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString(locale, {
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

function formatGpsDistance(
  value: string | number | null,
  t: (key: string, params?: Record<string, string | number | boolean>) => string
) {
  const distance = toNullableNumber(value);
  if (distance === null) return t('readingDetail.gpsDistanceUnknown');
  return t('readingDetail.gpsDistanceFromMeter', { value: Math.round(distance) });
}

function gpsDistanceMessage(
  value: string | number | null,
  t: (key: string) => string
) {
  const distance = toNullableNumber(value);
  if (distance === null) {
    return t('readingDetail.gpsIncomplete');
  }

  if (distance > 200) {
    return t('readingDetail.gpsFar');
  }

  return t('readingDetail.gpsOk');
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
  resubmitButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resubmitButtonText: {
    fontSize: 13,
    fontWeight: '800',
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
