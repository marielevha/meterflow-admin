import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppPage } from '@/components/app/app-page';
import { AppStateCard } from '@/components/app/app-state-card';
import { CircularLoading } from '@/components/app/circular-loading';
import { MissionListCard } from '@/components/missions/mission-list-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/use-i18n';
import { useSafePush } from '@/hooks/use-safe-push';
import {
  listAgentTasks,
  startAgentTask,
  transitionAgentTask,
  type AgentMission,
  type AgentMissionSummary,
} from '@/lib/api/agent-tasks';
import { isAgentAuthError, toAgentErrorMessage } from '@/lib/api/agent-client';
import { useAgentSession } from '@/providers/agent-session-provider';
import { useMobileNotifications } from '@/providers/mobile-notifications-provider';

const EMPTY_SUMMARY: AgentMissionSummary = {
  allCount: 0,
  todayCount: 0,
  overdueCount: 0,
  inProgressCount: 0,
  doneCount: 0,
};

export default function AgentHomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { t, locale } = useI18n();
  const { safePush } = useSafePush();
  const { logout } = useAgentSession();
  const { unreadCount, refreshUnreadCount } = useMobileNotifications();
  const [summary, setSummary] = useState<AgentMissionSummary>(EMPTY_SUMMARY);
  const [overdueMissions, setOverdueMissions] = useState<AgentMission[]>([]);
  const [todayMissions, setTodayMissions] = useState<AgentMission[]>([]);
  const [inProgressMissions, setInProgressMissions] = useState<AgentMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{ taskId: string; action: 'start' | 'block' | 'complete' } | null>(null);

  const loadHome = useCallback(
    async (activeRef: { current: boolean } = { current: true }) => {
      setLoading(true);
      setError(null);

      try {
        const [summaryResult, overdueResult, todayResult, inProgressResult] = await Promise.all([
          listAgentTasks({ page: 1, pageSize: 1 }),
          listAgentTasks({ filter: 'OVERDUE', page: 1, pageSize: 2 }),
          listAgentTasks({ filter: 'TODAY', page: 1, pageSize: 3 }),
          listAgentTasks({ filter: 'IN_PROGRESS', page: 1, pageSize: 2 }),
        ]);

        if (!activeRef.current) {
          return;
        }

        setSummary(summaryResult.summary);
        setOverdueMissions(overdueResult.missions);
        setTodayMissions(todayResult.missions);
        setInProgressMissions(inProgressResult.missions);
      } catch (loadError) {
        if (!activeRef.current) {
          return;
        }

        setError(toAgentErrorMessage(loadError, t('missions.loadingFallback')));

        if (isAgentAuthError(loadError)) {
          await logout();
        }
      } finally {
        if (activeRef.current) {
          setLoading(false);
        }
      }
    },
    [logout, t]
  );

  useFocusEffect(
    useCallback(() => {
      const activeRef = { current: true };
      void loadHome(activeRef);

      return () => {
        activeRef.current = false;
      };
    }, [loadHome])
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

      await Promise.all([loadHome(), refreshUnreadCount()]);
    } catch (actionError) {
      if (isAgentAuthError(actionError)) {
        await logout();
      }
      Alert.alert(t('missions.loadingErrorTitle'), toAgentErrorMessage(actionError, t('missions.quickActionFallback')));
    } finally {
      setBusyAction(null);
    }
  }

  const spotlightMissions = overdueMissions.length > 0 ? overdueMissions : inProgressMissions;
  const spotlightTitle = overdueMissions.length > 0 ? t('home.prioritySectionTitle') : t('home.activeSectionTitle');
  const spotlightDescription =
    overdueMissions.length > 0 ? t('home.prioritySectionText') : t('home.activeSectionText');

  return (
    <AppPage title={t('missions.title')}>
      <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.heroHeader}>
          <View style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="briefcase-outline" size={22} color={palette.accent} />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={[styles.heroTitle, { color: palette.headline }]}>{t('home.heroTitle')}</Text>
            <Text style={[styles.heroText, { color: palette.muted }]}>{t('home.heroText')}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <KpiCard label={t('missions.todayCard')} value={String(summary.todayCount)} palette={palette} />
          <KpiCard label={t('missions.inProgressCard')} value={String(summary.inProgressCount)} palette={palette} />
          <KpiCard label={t('missions.overdueCard')} value={String(summary.overdueCount)} palette={palette} tone="warning" />
        </View>
      </View>

      <Pressable
        onPress={() => safePush('/notifications')}
        style={[styles.notificationCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.notificationMain}>
          <View style={[styles.notificationIcon, { backgroundColor: palette.surfaceMuted }]}>
            <Ionicons name="notifications-outline" size={18} color={palette.primary} />
          </View>
          <View style={styles.notificationTextBlock}>
            <Text style={[styles.notificationTitle, { color: palette.headline }]}>{t('common.notifications')}</Text>
            <Text style={[styles.notificationText, { color: palette.muted }]}>
              {unreadCount > 0
                ? t('home.unreadNotificationsText').replace('{count}', String(unreadCount))
                : t('home.noUnreadNotificationsText')}
            </Text>
          </View>
        </View>
        {unreadCount > 0 ? (
          <View style={[styles.notificationCount, { backgroundColor: palette.danger }]}>
            <Text style={styles.notificationCountText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={palette.icon} />
        )}
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
          onActionPress={() => void loadHome()}
        />
      ) : (
        <>
          <SectionHeader
            title={spotlightTitle}
            description={spotlightDescription}
            actionLabel={t('common.viewAll')}
            onPress={() => safePush('/(tabs)/explore')}
            palette={palette}
          />

          {spotlightMissions.length === 0 ? (
            <AppStateCard
              palette={palette}
              icon="checkmark-done-outline"
              title={t('home.allClearTitle')}
              description={t('home.allClearText')}
            />
          ) : (
            <View style={styles.stack}>
              {spotlightMissions.map((mission) => (
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

          <SectionHeader
            title={t('home.todaySectionTitle')}
            description={t('home.todaySectionText')}
            actionLabel={t('common.viewAll')}
            onPress={() => safePush('/(tabs)/explore')}
            palette={palette}
          />

          {todayMissions.length === 0 ? (
            <AppStateCard
              palette={palette}
              icon="calendar-clear-outline"
              title={t('home.emptyTodayTitle')}
              description={t('home.emptyTodayText')}
            />
          ) : (
            <View style={styles.stack}>
              {todayMissions.map((mission) => (
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
        </>
      )}
    </AppPage>
  );
}

function SectionHeader({
  title,
  description,
  actionLabel,
  onPress,
  palette,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color: palette.headline }]}>{title}</Text>
        <Text style={[styles.sectionDescription, { color: palette.muted }]}>{description}</Text>
      </View>
      <Pressable onPress={onPress} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: palette.primary }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function KpiCard({
  label,
  value,
  palette,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  palette: (typeof Colors)['light'];
  tone?: 'neutral' | 'warning';
}) {
  return (
    <View
      style={[
        styles.kpiCard,
        {
          backgroundColor: tone === 'warning' ? '#fff6e7' : palette.surfaceMuted,
        },
      ]}>
      <Text
        style={[
          styles.kpiValue,
          { color: tone === 'warning' ? '#9a6514' : palette.headline },
        ]}>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  notificationCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  notificationMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTextBlock: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  notificationText: {
    fontSize: 13,
    lineHeight: 19,
  },
  notificationCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  notificationCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  loadingWrap: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionAction: {
    paddingTop: 2,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stack: {
    gap: 12,
  },
});
