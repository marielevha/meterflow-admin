import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileReading = {
  id: string;
  meterId: string;
  status: string;
  source: string;
  readingAt: string;
  primaryIndex: string | number | null;
  secondaryIndex: string | number | null;
  imageUrl: string | null;
  gpsLatitude: string | number | null;
  gpsLongitude: string | number | null;
  gpsAccuracyMeters: string | number | null;
  gpsDistanceMeters: string | number | null;
  rejectionReason: string | null;
  flagReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  meter: {
    id: string;
    serialNumber: string;
    meterReference: string | null;
    type: string;
    city: string | null;
    zone: string | null;
  };
};

export async function listClientReadings(accessToken: string) {
  void accessToken;
  return fetchMobileJson<{ readings: MobileReading[] }>({ path: '/api/v1/mobile/readings' });
}

type CreateReadingPayload = {
  meterId: string;
  primaryIndex: number;
  secondaryIndex?: number;
  imageUrl: string;
  imageHash?: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracyMeters?: number;
  readingAt: string;
  idempotencyKey: string;
};

export async function createClientReading(payload: CreateReadingPayload) {
  return fetchMobileJson<{ message: string; reading: MobileReading }>({
    path: '/api/v1/mobile/readings',
    method: 'POST',
    body: payload,
  });
}

export type MobileReadingDetail = MobileReading & {
  meter: MobileReading['meter'] & {
    addressLine1: string | null;
  };
  reviewedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  } | null;
  events: Array<{
    id: string;
    type: string;
    payload: unknown;
    createdAt: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      role: string;
    } | null;
  }>;
};

export async function getClientReadingDetail(readingId: string) {
  return fetchMobileJson<{ reading: MobileReadingDetail }>({
    path: `/api/v1/mobile/readings/${readingId}`,
  });
}
