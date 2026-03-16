import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileMeterState = {
  id: string;
  effectiveAt: string;
  previousPrimary: string | number | null;
  previousSecondary: string | number | null;
  currentPrimary: string | number | null;
  currentSecondary: string | number | null;
};

export type MobileMeter = {
  id: string;
  serialNumber: string;
  meterReference: string | null;
  type: string;
  status: string;
  city: string | null;
  zone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  installedAt: string | null;
  lastInspectionAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAgent: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string | null;
  } | null;
  states: MobileMeterState[];
};

export async function listClientMeters(accessToken: string) {
  void accessToken;
  return fetchMobileJson<{ meters: MobileMeter[] }>({ path: '/api/v1/mobile/meters' });
}

export async function getClientMeterDetail(meterId: string) {
  return fetchMobileJson<{ meter: MobileMeter }>({ path: `/api/v1/mobile/meters/${meterId}` });
}
