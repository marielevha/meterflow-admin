import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileProfileUser = {
  id: string;
  phone: string | null;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  region: string | null;
  city: string | null;
  zone: string | null;
  role: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileProfileSummary = {
  meterCount: number;
  readingCount: number;
  pendingReadingCount: number;
};

export async function getMobileProfile() {
  return fetchMobileJson<{
    user: MobileProfileUser;
    summary: MobileProfileSummary;
  }>({
    path: '/api/v1/mobile/me',
  });
}

export async function updateMobileProfile(payload: {
  firstName?: string | null;
  lastName?: string | null;
  region?: string | null;
  city?: string | null;
  zone?: string | null;
}) {
  return fetchMobileJson<{
    message: string;
    user: MobileProfileUser;
  }>({
    path: '/api/v1/mobile/me',
    method: 'PATCH',
    body: payload,
  });
}

export async function changeMobilePassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  return fetchMobileJson<{
    message: string;
  }>({
    path: '/api/v1/mobile/me/password',
    method: 'PATCH',
    body: payload,
  });
}
