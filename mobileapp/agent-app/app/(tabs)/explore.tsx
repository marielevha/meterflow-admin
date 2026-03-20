import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { RequireAgentAuth } from '@/components/auth/require-agent-auth';
import { MissionListCard } from '@/components/missions/mission-list-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import {
  listAgentTasks,
  type AgentMissionFilter,
  type AgentMissionSummary,
  startAgentTask,
  transitionAgentTask,
} from '@/lib/api/agent-tasks';
import { isAgentAuthError, toAgentErrorMessage } from '@/lib/api/agent-client';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

const DEFAULT_SUMMARY: AgentMissionSummary = {
  allCount: 0,
  todayCount: 0,
  overdueCount: 0,
  inProgressCount: 0,
  doneCount: 0,
};

export default function MissionsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t, locale } = useI18n();
  const { logout } = useAgentSession();
  const { refreshUnreadCount } = useMobileNotifications();
  const { safePush } = useSafePush();
  const [missions, setMissions] = useState<Awaited<ReturnType<typeof listAgentTasks>>['missions']>([]);
  const [summary, setSummary] = useState<AgentMissionSummary>(DEFAULT_SUMMARY);
  const [filter, setFilter] = useState<AgentMissionFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilterSelect, setShowFilterSelect] = useState(false);
  const [busyAction, setBusyAction] = useState<{ taskId: string; action: 'start' | 'block' | 'complete' } | null>(null);

  const missionFilters = useMemo(
    () => [
      { value: 'ALL' as const, label: t('missions.filterAll') },
      { value: 'TODAY' as const, label: t('missions.filterToday') },
      { value: 'OVERDUE' as const, label: t('missions.filterOverdue') },
      { value: 'IN_PROGRESS' as const, label: t('missions.filterInProgress') },
      { value: 'DONE' as const, label: t('missions.filterDone') },
    ],
    [t]
  );

  const loadMissions = useCallback(async (activeRef: { current: boolean } = { current: true }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await listAgentTasks({
        filter,
        page: 1,
        pageSize: 25,
      });

      if (!activeRef.current) return;
      setMissions(result.missions);
      setSummary(result.summary);
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
  }, [filter, logout, t]);

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadMissions(activeRef);

      return () => {
        activeRef.current = false;
      };
    }, [loadMissions])
  );

  async function handleQuickAction(taskId: string, action: 'start' | 'block' | 'complete') {
    if (busyAction) {
      return;
    }

    setBusyAction({ taskId, action });

    try {
      if (action === 'start') {
        await startAgentTask(taskId);
      } else if (action === 'block') {
        await transitionAgentTask(taskId, 'BLOCKED');
      } else {
        await transitionAgentTask(taskId, 'DONE');
      }

      await Promise.all([loadMissions(), refreshUnreadCount()]);
    } catch (actionError) {
      if (isAgentAuthError(actionError)) {
        await logout();
      }
      Alert.alert(t('missions.loadingErrorTitle'), toAgentErrorMessage(actionError, t('missions.quickActionFallback')));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <RequireAgentAuth>
      <AppPage title={t('missions.title')}>
        <View style={styles.summaryGrid}>
          <SummaryCard
            label={t('missions.todayCard')}
            value={String(summary.todayCount)}
            icon="today-outline"
            palette={palette}
            active={filter === 'TODAY'}
            onPress={() => setFilter('TODAY')}
          />
          <SummaryCard
            label={t('missions.overdueCard')}
            value={String(summary.overdueCount)}
            icon="warning-outline"
            palette={palette}
            active={filter === 'OVERDUE'}
            onPress={() => setFilter('OVERDUE')}
            tone="warning"
          />
          <SummaryCard
            label={t('missions.inProgressCard')}
            value={String(summary.inProgressCount)}
            icon="sync-outline"
            palette={palette}
            active={filter === 'IN_PROGRESS'}
            onPress={() => setFilter('IN_PROGRESS')}
          />
          <SummaryCard
            label={t('missions.doneCard')}
            value={String(summary.doneCount)}
            icon="checkmark-done-outline"
            palette={palette}
            active={filter === 'DONE'}
            onPress={() => setFilter('DONE')}
            tone="success"
          />
        </View>

        <Pressable
          onPress={() => setShowFilterSelect(true)}
          style={[styles.filterSelect, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.filterSelectLeft}>
            <Ionicons name="filter-outline" size={18} color={palette.icon} />
            <Text style={[styles.filterSelectLabel, { color: palette.muted }]}>{t('missions.filterLabel')}</Text>
          </View>
          <View style={styles.filterSelectRight}>
            <Text style={[styles.filterSelectValue, { color: palette.headline }]}>
              {missionFilters.find((item) => item.value === filter)?.label ?? t('missions.filterAll')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.icon} />
          </View>
        </Pressable>

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
            onActionPress={() => void loadMissions()}
          />
        ) : missions.length === 0 ? (
          <AppStateCard
            palette={palette}
            icon="briefcase-outline"
            title={t('missions.emptyTitle')}
            description={t('missions.emptyDescription')}
          />
        ) : (
          <View style={styles.stack}>
            {missions.map((mission) => (
              <MissionListCard
                key={mission.id}
                mission={mission}
                palette={palette}
                locale={locale}
                t={t}
                onPress={() =>
                  safePush({
                    pathname: '/missions/[id]',
                    params: { id: mission.id },
                  })
                }
                onStart={() => void handleQuickAction(mission.id, 'start')}
                onBlock={() => void handleQuickAction(mission.id, 'block')}
                onComplete={() => void handleQuickAction(mission.id, 'complete')}
                busyAction={busyAction?.taskId === mission.id ? busyAction.action : null}
              />
            ))}
          </View>
        )}

        <Modal
          visible={showFilterSelect}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFilterSelect(false)}>
          <View style={styles.filterModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilterSelect(false)} />
            <View
              style={[
                styles.filterModalCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}>
              <View style={styles.filterModalHeader}>
                <Text style={[styles.filterModalTitle, { color: palette.headline }]}> 
                  {t('missions.filterTitle')}
                </Text>
                <Pressable
                  onPress={() => setShowFilterSelect(false)}
                  style={[styles.filterModalClose, { backgroundColor: palette.surfaceMuted }]}> 
                  <Ionicons name="close" size={18} color={palette.icon} />
                </Pressable>
              </View>

              <View style={styles.filterOptions}>
                {missionFilters.map((item) => {
                  const active = filter === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => {
                        setFilter(item.value);
                        setShowFilterSelect(false);
                      }}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: active ? palette.accentSoft : palette.surfaceMuted,
                          borderColor: active ? palette.accent : palette.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.filterOptionText,
                          { color: active ? palette.primary : palette.headline },
                        ]}>
                        {item.label}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={18} color={palette.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </AppPage>
    </RequireAgentAuth>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  palette,
  active,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: (typeof Colors)['light'];
  active: boolean;
  onPress: () => void;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const accentColor =
    tone === 'warning' ? '#c77c11' : tone === 'success' ? palette.success : palette.accent;
  const softBackground =
    tone === 'warning' ? '#fff6e7' : tone === 'success' ? '#edf9f0' : palette.accentSoft;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.summaryCard,
        {
          backgroundColor: active ? softBackground : palette.surface,
          borderColor: active ? accentColor : palette.border,
        },
      ]}>
      <View style={[styles.summaryIcon, { backgroundColor: active ? `${accentColor}20` : palette.surfaceMuted }]}> 
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={[styles.summaryValue, { color: palette.headline }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  filterSelect: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterSelectLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterSelectLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterSelectRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    maxWidth: '62%',
  },
  filterSelectValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingWrap: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: 12,
  },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  filterModalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  filterModalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptions: {
    gap: 10,
  },
  filterOption: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
