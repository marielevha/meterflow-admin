import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileConsumptionMeter = {
  id: string;
  serialNumber: string;
  type: string;
};

export type MobileConsumptionEntry = {
  meterId: string;
  meterSerialNumber: string;
  meterType: string;
  periodKey: string;
  periodLabel: string;
  primaryConsumption: number;
  secondaryConsumption: number | null;
  totalConsumption: number;
  effectiveAt: string;
};

export type MobileConsumptionDetail = {
  meter: {
    id: string;
    serialNumber: string;
    meterReference: string | null;
    type: string;
    city: string | null;
    zone: string | null;
  };
  periodKey: string;
  periodLabel: string;
  primaryConsumption: number;
  secondaryConsumption: number | null;
  totalConsumption: number;
  items: Array<{
    id: string;
    effectiveAt: string;
    sourceReadingId: string | null;
    previousPrimary: number | null;
    currentPrimary: number | null;
    previousSecondary: number | null;
    currentSecondary: number | null;
    deltaPrimary: number | null;
    deltaSecondary: number | null;
    createdAt: string;
  }>;
};

export async function listClientConsumption(params: { meterId?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.meterId) query.set('meterId', params.meterId);
  if (params.limit) query.set('limit', String(params.limit));

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return fetchMobileJson<{
    meters: MobileConsumptionMeter[];
    consumptions: MobileConsumptionEntry[];
  }>({
    path: `/api/v1/mobile/consumption${suffix}`,
  });
}

export async function getClientConsumptionDetail(meterId: string, periodKey: string) {
  const query = new URLSearchParams({ periodKey });

  return fetchMobileJson<{
    consumption: MobileConsumptionDetail;
  }>({
    path: `/api/v1/mobile/consumption/${meterId}?${query.toString()}`,
  });
}
