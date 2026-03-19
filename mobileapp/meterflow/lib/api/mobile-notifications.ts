import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileNotification = {
  id: string;
  type: string;
  createdAt: string;
  title: string;
  body: string;
  readingId: string;
  meterId: string;
  meterSerialNumber: string;
  status: string;
  reasonCode: string | null;
  reasonLabel: string | null;
};

export async function listClientNotifications() {
  return fetchMobileJson<{ notifications: MobileNotification[] }>({
    path: '/api/v1/mobile/notifications',
  });
}
