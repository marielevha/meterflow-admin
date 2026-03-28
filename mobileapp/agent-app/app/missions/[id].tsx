import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import { getAgentTaskDetail, startAgentTask, type AgentMissionDetail } from '@/lib/api/agent-tasks';
import { isAgentAuthError, toAgentErrorMessage } from '@/lib/api/agent-client';
import { getAgentMeterIndexLabels } from '@/lib/meters/index-labels';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

export default function MissionDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ id?: string; notificationId?: string | string[] }>();
  const { logout } = useAgentSession();
  const { markNotificationsRead, refreshUnreadCount } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [mission, setMission] = useState<AgentMissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const loadDetail = useCallback(
    async (activeRef: { current: boolean } = { current: true }) => {
      if (!params.id) {
        setError(t('missions.notFoundDescription'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getAgentTaskDetail(params.id);
        if (!activeRef.current) return;
        setMission(result.mission);
      } catch (loadError) {
        if (!activeRef.current) return;
        const message = toAgentErrorMessage(loadError, t('missions.loadingFallback'));
        setError(message);
        if (isAgentAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          setLoading(false);
        }
      }
    },
    [logout, params.id, t]
  );

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadDetail(activeRef);

      return () => {
        activeRef.current = false;
      };
    }, [loadDetail])
  );

  useFocusEffect(
    useCallback(() => {
      const notificationId = Array.isArray(params.notificationId)
        ? params.notificationId[0]
        : params.notificationId;

      if (notificationId && notificationId.trim()) {
        void markNotificationsRead([notificationId]);
      }
    }, [markNotificationsRead, params.notificationId])
  );

  const historyEntries = useMemo(() => mission?.timeline ?? [], [mission?.timeline]);
  const indexLabels = mission ? getAgentMeterIndexLabels(mission.meter.type, t) : null;
  const canReport = Boolean(mission && !['DONE', 'CANCELED'].includes(mission.status));
  const canStart = Boolean(mission && mission.status === 'OPEN');

  async function handleStartMission() {
    if (!params.id || isStarting) {
      return;
    }

    setIsStarting(true);
    try {
      await startAgentTask(params.id);
      await loadDetail();
      await refreshUnreadCount();
    } catch (startError) {
      if (isAgentAuthError(startError)) {
        await logout();
      }
      Alert.alert(t('missions.loadingErrorTitle'), toAgentErrorMessage(startError, t('missions.startFallback')));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <RequireAgentAuth>
      <AppPage title={t('missions.detailTitle')} topBarMode="back" backHref="/(tabs)/explore">
        {loading ? (
          <View style={styles.loadingWrap}>
            <CircularLoading palette={palette} />
          </View>
        ) : error ? (
          <AppStateCard
            palette={palette}
            icon="cloud-offline-outline"
            title={t('missions.loadingErrorTitle')}
            description={error}
            tone="danger"
            actionLabel={t('common.retry')}
            onActionPress={() => void loadDetail()}
          />
        ) : !mission ? (
          <AppStateCard
            palette={palette}
            icon="briefcase-outline"
            title={t('missions.notFoundTitle')}
            description={t('missions.notFoundDescription')}
          />
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
              <View style={styles.heroTop}>
                <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft }]}> 
                  <Ionicons name="briefcase-outline" size={22} color={palette.accent} />
                </View>
                <View style={styles.heroBody}>
                  <Text style={[styles.heroTitle, { color: palette.headline }]}>{mission.title}</Text>
                  <Text style={[styles.heroMeta, { color: palette.muted }]}>{mission.client.name}</Text>
                </View>
              </View>

              <View style={styles.heroBadges}>
                <Pill label={humanizeMissionStatus(mission.status, t)} palette={palette} tone={toneForStatus(mission.status)} />
                <Pill label={humanizeMissionPriority(mission.priority, t)} palette={palette} tone="accent" />
                <Pill label={humanizeMissionType(mission.type, t)} palette={palette} />
              </View>
            </View>

            {(canStart || canReport) && (
              <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionActions')}</Text>
                <View style={styles.actionRow}>
                  {canStart ? (
                    <Pressable
                      onPress={() => void handleStartMission()}
                      disabled={isStarting}
                      style={[
                        styles.actionButton,
                        { backgroundColor: palette.accentSoft, borderColor: palette.accent },
                      ]}>
                      {isStarting ? (
                        <CircularLoading palette={palette} size={26} />
                      ) : (
                        <Ionicons name="play-outline" size={18} color={palette.primary} />
                      )}
                      <Text style={[styles.actionButtonText, { color: palette.primary }]}>
                        {t('missions.startMission')}
                      </Text>
                    </Pressable>
                  ) : null}

                  {canReport ? (
                    <Pressable
                      onPress={() =>
                        safePush({
                          pathname: '/missions/[id]/report',
                          params: { id: mission.id },
                        })
                      }
                      style={[
                        styles.actionButton,
                        { backgroundColor: palette.primary, borderColor: palette.primary },
                      ]}>
                      <Ionicons name="camera-outline" size={18} color="#ffffff" />
                      <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                        {mission.fieldReport ? t('missions.updateReport') : t('missions.openReport')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionOverview')}</Text>
              <View style={styles.infoGrid}>
                <InfoItem label={t('missions.fieldType')} value={humanizeMissionType(mission.type, t)} palette={palette} />
                <InfoItem label={t('missions.fieldStatus')} value={humanizeMissionStatus(mission.status, t)} palette={palette} />
                <InfoItem label={t('missions.fieldPriority')} value={humanizeMissionPriority(mission.priority, t)} palette={palette} />
                <InfoItem
                  label={t('missions.fieldOutcome')}
                  value={mission.resolutionCode ? humanizeMissionResolution(mission.resolutionCode, t) : t('common.notProvided')}
                  palette={palette}
                />
                <InfoItem label={t('missions.fieldReason')} value={mission.title} palette={palette} />
                <InfoItem label={t('missions.fieldDueDate')} value={formatNullableDate(mission.dueAt, locale, t)} palette={palette} />
                <InfoItem
                  label={t('missions.fieldStartedAt')}
                  value={formatNullableDateTime(mission.startedAt, locale, t)}
                  palette={palette}
                />
                <InfoItem label={t('missions.fieldCreatedAt')} value={formatDate(mission.createdAt, locale)} palette={palette} />
              </View>

              <View style={[styles.noteCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}> 
                <Text style={[styles.noteTitle, { color: palette.headline }]}>{t('missions.fieldDetails')}</Text>
                <Text style={[styles.noteBody, { color: palette.muted }]}>
                  {mission.description?.trim() || t('missions.noDescription')}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionContext')}</Text>
              <View style={styles.infoGrid}>
                <InfoItem label={t('missions.fieldClient')} value={mission.client.name} palette={palette} />
                <InfoItem label={t('missions.fieldClientPhone')} value={mission.client.phone || t('common.notProvided')} palette={palette} />
                <InfoItem label={t('missions.fieldMeter')} value={mission.meter.serialNumber} palette={palette} />
                <InfoItem label={t('missions.fieldReference')} value={mission.meter.meterReference || t('common.notProvided')} palette={palette} />
                <InfoItem label={t('missions.fieldAddress')} value={mission.meter.addressLabel} palette={palette} />
                <InfoItem label={t('missions.fieldAssignedTo')} value={mission.assignedTo.name} palette={palette} />
                <InfoItem label={t('missions.fieldAssignedBy')} value={mission.createdBy.name} palette={palette} />
              </View>
            </View>

            {mission.fieldReport ? (
              <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionFieldReport')}</Text>
                <View style={styles.infoGrid}>
                  <InfoItem
                    label={t('missions.fieldOutcome')}
                    value={
                      mission.fieldReport.resolutionCode
                        ? humanizeMissionResolution(mission.fieldReport.resolutionCode, t)
                        : t('common.notProvided')
                    }
                    palette={palette}
                  />
                  <InfoItem
                    label={t('missions.fieldSubmittedAt')}
                    value={formatNullableDateTime(mission.fieldReport.submittedAt, locale, t)}
                    palette={palette}
                  />
                  <InfoItem
                    label={t('missions.fieldStartedBy')}
                    value={mission.fieldReport.startedByName}
                    palette={palette}
                  />
                  <InfoItem
                    label={t('missions.fieldGps')}
                    value={formatGps(mission.fieldReport.gpsLatitude, mission.fieldReport.gpsLongitude)}
                    palette={palette}
                  />
                  <InfoItem
                    label={indexLabels?.primaryIndex ?? t('missions.fieldIndex')}
                    value={mission.fieldReport.primaryIndex?.toString() ?? '--'}
                    palette={palette}
                  />
                  {mission.meter.type === 'DUAL_INDEX' || mission.fieldReport.secondaryIndex !== null ? (
                    <InfoItem
                      label={indexLabels?.secondaryIndex ?? t('missions.fieldHcIndex')}
                      value={mission.fieldReport.secondaryIndex?.toString() ?? '--'}
                      palette={palette}
                    />
                  ) : null}
                </View>

                {mission.fieldReport.comment ? (
                  <View style={[styles.noteCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
                    <Text style={[styles.noteTitle, { color: palette.headline }]}>{t('missions.fieldComment')}</Text>
                    <Text style={[styles.noteBody, { color: palette.muted }]}>{mission.fieldReport.comment}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {mission.reading ? (
              <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionReading')}</Text>
                <View style={styles.infoGrid}>
                  <InfoItem label={t('missions.fieldReadingStatus')} value={mission.reading.status} palette={palette} />
                  <InfoItem label={t('missions.fieldReadingDate')} value={formatNullableDateTime(mission.reading.readingAt, locale, t)} palette={palette} />
                  <InfoItem
                    label={indexLabels?.primaryIndex ?? t('missions.fieldIndex')}
                    value={mission.reading.primaryIndex?.toString() ?? '--'}
                    palette={palette}
                  />
                  {mission.meter.type === 'DUAL_INDEX' || mission.reading.secondaryIndex !== null ? (
                    <InfoItem
                      label={indexLabels?.secondaryIndex ?? t('missions.fieldHcIndex')}
                      value={mission.reading.secondaryIndex?.toString() ?? '--'}
                      palette={palette}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {mission.reportedReading ? (
              <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionReportedReading')}</Text>
                <View style={styles.infoGrid}>
                  <InfoItem label={t('missions.fieldReadingStatus')} value={mission.reportedReading.status} palette={palette} />
                  <InfoItem label={t('missions.fieldReadingDate')} value={formatNullableDateTime(mission.reportedReading.readingAt, locale, t)} palette={palette} />
                  <InfoItem
                    label={indexLabels?.primaryIndex ?? t('missions.fieldIndex')}
                    value={mission.reportedReading.primaryIndex?.toString() ?? '--'}
                    palette={palette}
                  />
                  {mission.meter.type === 'DUAL_INDEX' || mission.reportedReading.secondaryIndex !== null ? (
                    <InfoItem
                      label={indexLabels?.secondaryIndex ?? t('missions.fieldHcIndex')}
                      value={mission.reportedReading.secondaryIndex?.toString() ?? '--'}
                      palette={palette}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
              <Text style={[styles.sectionTitle, { color: palette.headline }]}>{t('missions.sectionTimeline')}</Text>
              {historyEntries.length === 0 ? (
                <Text style={[styles.emptyText, { color: palette.muted }]}>{t('missions.noTimeline')}</Text>
              ) : (
                <View style={styles.timelineStack}>
                  {historyEntries.map((entry) => (
                    <View key={entry.id} style={[styles.timelineItem, { borderColor: palette.border }]}> 
                      <View style={[styles.timelineDot, { backgroundColor: palette.accent }]} />
                      <View style={styles.timelineBody}>
                        <Text style={[styles.timelineLabel, { color: palette.headline }]}>{entry.label}</Text>
                        <Text style={[styles.timelineMeta, { color: palette.muted }]}>
                          {formatDateTime(entry.at, locale)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </AppPage>
    </RequireAgentAuth>
  );
}

function Pill({
  label,
  palette,
  tone = 'neutral',
}: {
  label: string;
  palette: (typeof Colors)['light'];
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success';
}) {
  const toneMap =
    tone === 'accent'
      ? { backgroundColor: palette.accentSoft, color: palette.primary }
      : tone === 'warning'
        ? { backgroundColor: '#fff6e7', color: '#9a6514' }
        : tone === 'danger'
          ? { backgroundColor: '#fff0ef', color: palette.danger }
          : tone === 'success'
            ? { backgroundColor: '#edf9f0', color: palette.success }
            : { backgroundColor: palette.surfaceMuted, color: palette.headline };

  return (
    <View style={[styles.pill, { backgroundColor: toneMap.backgroundColor }]}> 
      <Text style={[styles.pillText, { color: toneMap.color }]}>{label}</Text>
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
    <View style={[styles.infoItem, { borderColor: `${palette.border}99` }]}> 
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.headline }]}>{value}</Text>
    </View>
  );
}

function toneForStatus(status: string) {
  switch (status) {
    case 'DONE':
      return 'success' as const;
    case 'BLOCKED':
      return 'warning' as const;
    case 'CANCELED':
      return 'danger' as const;
    case 'IN_PROGRESS':
      return 'accent' as const;
    default:
      return 'neutral' as const;
  }
}

function humanizeMissionStatus(status: string, t: (key: string) => string) {
  switch (status) {
    case 'OPEN':
      return t('missions.statusOpen');
    case 'IN_PROGRESS':
      return t('missions.statusInProgress');
    case 'BLOCKED':
      return t('missions.statusBlocked');
    case 'DONE':
      return t('missions.statusDone');
    case 'CANCELED':
      return t('missions.statusCanceled');
    default:
      return status;
  }
}

function humanizeMissionPriority(priority: string, t: (key: string) => string) {
  switch (priority) {
    case 'LOW':
      return t('missions.priorityLow');
    case 'MEDIUM':
      return t('missions.priorityMedium');
    case 'HIGH':
      return t('missions.priorityHigh');
    case 'CRITICAL':
      return t('missions.priorityCritical');
    default:
      return priority;
  }
}

function humanizeMissionType(type: string, t: (key: string) => string) {
  switch (type) {
    case 'FIELD_RECHECK':
      return t('missions.typeFieldRecheck');
    case 'FRAUD_INVESTIGATION':
      return t('missions.typeFraud');
    case 'METER_VERIFICATION':
      return t('missions.typeMeterVerification');
    case 'GENERAL':
      return t('missions.typeGeneral');
    default:
      return type;
  }
}

function humanizeMissionResolution(code: string, t: (key: string) => string) {
  switch (code) {
    case 'READING_CONFIRMED':
      return t('missions.resolutionReadingConfirmed');
    case 'READING_IMPOSSIBLE':
      return t('missions.resolutionReadingImpossible');
    case 'METER_INACCESSIBLE':
      return t('missions.resolutionMeterInaccessible');
    case 'METER_DAMAGED_OR_MISSING':
      return t('missions.resolutionMeterDamaged');
    case 'SUSPECTED_FRAUD':
      return t('missions.resolutionSuspectedFraud');
    case 'CUSTOMER_ABSENT':
      return t('missions.resolutionCustomerAbsent');
    case 'ESCALATION_REQUIRED':
      return t('missions.resolutionEscalation');
    default:
      return code;
  }
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

function formatDateTime(value: string, locale: string) {
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

function formatNullableDate(value: string | null, locale: string, t: (key: string) => string) {
  return value ? formatDate(value, locale) : t('missions.noDueDate');
}

function formatNullableDateTime(value: string | null, locale: string, t: (key: string) => string) {
  return value ? formatDateTime(value, locale) : t('common.notProvided');
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatGps(latitude: unknown, longitude: unknown) {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);

  if (lat === null || lng === null) return '--';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const styles = StyleSheet.create({
  loadingWrap: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: '600',
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  timelineStack: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  timelineLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  timelineMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
