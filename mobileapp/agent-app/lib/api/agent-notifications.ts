import { fetchAgentJson } from '@/lib/api/agent-client';

export type AgentTaskNotification = {
  id: string;
  type: 'ASSIGNED' | 'STARTED' | 'BLOCKED' | 'COMPLETED' | 'FIELD_RESULT_SUBMITTED';
  createdAt: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  taskDueAt: string | null;
  meterSerialNumber: string;
  customerName: string;
  actorName: string | null;
  comment: string | null;
  resolutionCode: string | null;
  nextStatus: string | null;
  previousStatus: string | null;
  source: string | null;
  isRead: boolean;
  readAt: string | null;
};

export async function listAgentNotifications(options?: {
  limit?: number;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();

  if (options?.limit) {
    searchParams.set('limit', String(options.limit));
  }

  if (options?.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  const query = searchParams.toString();
  return fetchAgentJson<{
    notifications: AgentTaskNotification[];
    unreadCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  }>({
    path: `/api/v1/agent-mobile/notifications${query ? `?${query}` : ''}`,
  });
}

export async function markAgentNotificationsRead(notificationIds?: string[]) {
  return fetchAgentJson<{
    message: string;
    markedCount: number;
    unreadCount: number;
  }>({
    path: '/api/v1/agent-mobile/notifications',
    method: 'PATCH',
    body: notificationIds?.length ? { notificationIds } : {},
  });
}
