import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { type AgentMission } from '@/lib/api/agent-tasks';

type MissionListCardProps = {
  mission: AgentMission;
  palette: (typeof Colors)['light'];
  locale: string;
  t: (key: string) => string;
  onPress: () => void;
  onStart?: () => void;
  onBlock?: () => void;
  onComplete?: () => void;
  busyAction?: 'start' | 'block' | 'complete' | null;
  showActions?: boolean;
};

export function MissionListCard({
  mission,
  palette,
  locale,
  t,
  onPress,
  onStart,
  onBlock,
  onComplete,
  busyAction = null,
  showActions = true,
}: MissionListCardProps) {
  const canStart = mission.status === 'OPEN' || mission.status === 'BLOCKED';
  const canBlock = mission.status === 'OPEN' || mission.status === 'IN_PROGRESS';
  const canComplete = mission.status !== 'DONE' && mission.status !== 'CANCELED';
  const actionsVisible = showActions && (canStart || canBlock || canComplete);
  const busy = busyAction !== null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.9 : 1 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            <Text style={[styles.cardTitle, { color: palette.headline }]} numberOfLines={2}>
              {mission.title}
            </Text>
            <Text style={[styles.cardMeta, { color: palette.muted }]} numberOfLines={1}>
              {mission.customer.name}
            </Text>
          </View>

          <View style={[styles.statusPill, statusPillStyle(mission.status, palette)]}>
            <Text style={[styles.statusPillText, statusPillTextStyle(mission.status, palette)]}>
              {humanizeMissionStatus(mission.status, t)}
            </Text>
          </View>
        </View>

        <View style={styles.badgesRow}>
          <Badge label={humanizeMissionType(mission.type, t)} palette={palette} />
          <Badge label={humanizeMissionPriority(mission.priority, t)} palette={palette} tone="accent" />
          {mission.isOverdue ? <Badge label={t('missions.overdueFlag')} palette={palette} tone="danger" /> : null}
          {mission.isToday ? <Badge label={t('missions.todayFlag')} palette={palette} tone="warning" /> : null}
          {mission.hasFieldReport ? <Badge label={t('missions.reportReady')} palette={palette} tone="success" /> : null}
        </View>

        <View style={styles.infoList}>
          <InfoLine icon="flash-outline" label={mission.meter.serialNumber} palette={palette} />
          <InfoLine icon="location-outline" label={mission.meter.addressLabel} palette={palette} />
          <InfoLine icon="calendar-outline" label={formatMissionDate(mission.dueAt, locale, t)} palette={palette} />
        </View>
      </Pressable>

      {actionsVisible ? (
        <View style={[styles.actionsRow, { borderTopColor: palette.border }]}>
          {canStart ? (
            <ActionButton
              icon="play-outline"
              label={t('missions.startMission')}
              palette={palette}
              disabled={busy}
              loading={busyAction === 'start'}
              onPress={onStart}
            />
          ) : null}
          {canBlock ? (
            <ActionButton
              icon="pause-outline"
              label={t('missions.blockMission')}
              palette={palette}
              tone="warning"
              disabled={busy}
              loading={busyAction === 'block'}
              onPress={onBlock}
            />
          ) : null}
          {canComplete ? (
            <ActionButton
              icon="checkmark-outline"
              label={t('missions.completeMission')}
              palette={palette}
              tone="success"
              disabled={busy}
              loading={busyAction === 'complete'}
              onPress={onComplete}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  palette,
  tone = 'neutral',
  disabled,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: (typeof Colors)['light'];
  tone?: 'neutral' | 'warning' | 'success';
  disabled: boolean;
  loading: boolean;
  onPress?: () => void;
}) {
  const toneStyle =
    tone === 'warning'
      ? { backgroundColor: '#fff6e7', borderColor: '#f0d2a0', color: '#9a6514' }
      : tone === 'success'
        ? { backgroundColor: '#edf9f0', borderColor: '#b9e2c4', color: palette.success }
        : { backgroundColor: palette.accentSoft, borderColor: `${palette.accent}44`, color: palette.primary };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <Ionicons
        name={loading ? 'hourglass-outline' : icon}
        size={15}
        color={toneStyle.color}
      />
      <Text style={[styles.actionButtonText, { color: toneStyle.color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Badge({
  label,
  palette,
  tone = 'neutral',
}: {
  label: string;
  palette: (typeof Colors)['light'];
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success';
}) {
  const stylesByTone =
    tone === 'accent'
      ? { backgroundColor: palette.accentSoft, color: palette.primary }
      : tone === 'warning'
        ? { backgroundColor: '#fff6e7', color: '#9a6514' }
        : tone === 'danger'
          ? { backgroundColor: '#fff0ef', color: palette.danger }
          : tone === 'success'
            ? { backgroundColor: '#edf9f0', color: palette.success }
            : { backgroundColor: palette.surfaceMuted, color: palette.muted };

  return (
    <View style={[styles.badge, { backgroundColor: stylesByTone.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: stylesByTone.color }]}>{label}</Text>
    </View>
  );
}

function InfoLine({
  icon,
  label,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={15} color={palette.icon} />
      <Text style={[styles.infoLineText, { color: palette.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function humanizeMissionStatus(status: string, t: (key: string) => string) {
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

export function humanizeMissionPriority(priority: string, t: (key: string) => string) {
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

export function humanizeMissionType(type: string, t: (key: string) => string) {
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

export function formatMissionDate(value: string | null, locale: string, t: (key: string) => string) {
  if (!value) {
    return t('missions.noDueDate');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('missions.noDueDate');
  }

  return `${t('missions.dueAtShort')} ${date.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
}

function statusPillStyle(status: string, palette: (typeof Colors)['light']) {
  switch (status) {
    case 'DONE':
      return { backgroundColor: '#edf9f0' };
    case 'IN_PROGRESS':
      return { backgroundColor: palette.accentSoft };
    case 'BLOCKED':
      return { backgroundColor: '#fff4e8' };
    case 'CANCELED':
      return { backgroundColor: '#fff0ef' };
    default:
      return { backgroundColor: palette.surfaceMuted };
  }
}

function statusPillTextStyle(status: string, palette: (typeof Colors)['light']) {
  switch (status) {
    case 'DONE':
      return { color: palette.success };
    case 'IN_PROGRESS':
      return { color: palette.primary };
    case 'BLOCKED':
      return { color: '#9a6514' };
    case 'CANCELED':
      return { color: palette.danger };
    default:
      return { color: palette.headline };
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardPressable: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardHeaderMain: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  infoList: {
    gap: 8,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionsRow: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 96,
  },
});
