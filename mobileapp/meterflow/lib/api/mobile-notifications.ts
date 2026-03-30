import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileNotification = {
  id: string;
  type: string;
  category: string;
  createdAt: string;
  title: string;
  body: string;
  actionPath: string | null;
  readingId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  meterId: string | null;
  meterSerialNumber: string | null;
  status: string | null;
  statusLabel: string | null;
  reasonCode: string | null;
  reasonLabel: string | null;
  channel: string | null;
  paymentMethod: string | null;
  assignmentSource: string | null;
  isRead: boolean;
  readAt: string | null;
};

type ListNotificationsOptions = {
  limit?: number;
  cursor?: string;
};

export async function listClientNotifications(options?: ListNotificationsOptions) {
  const search = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    search.set('limit', String(options.limit));
  }
  if (typeof options?.cursor === 'string' && options.cursor.trim().length > 0) {
    search.set('cursor', options.cursor);
  }

  return fetchMobileJson<{
    notifications: MobileNotification[];
    unreadCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  }>({
    path: `/api/v1/mobile/notifications${search.size ? `?${search.toString()}` : ''}`,
  });
}

export async function markClientNotificationsRead(notificationIds?: string[]) {
  return fetchMobileJson<{ message: string; markedCount: number; unreadCount: number }>({
    path: '/api/v1/mobile/notifications',
    method: 'PATCH',
    body: {
      ...(notificationIds?.length ? { notificationIds } : {}),
    },
  });
}
