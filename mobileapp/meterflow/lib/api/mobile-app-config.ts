import { fetchMobileJson } from '@/lib/api/mobile-client';

export type MobileAppConfig = {
  requireGpsForReading: boolean;
  maxGpsDistanceMeters: number;
  maxImageSizeMb: number;
  readingSubmissionWindow: {
    isOpen: boolean;
    windowStart: string;
    windowEnd: string;
    timeZone: string;
    startDay: number;
    endDay: number;
  };
};

export async function getMobileAppConfig() {
  return fetchMobileJson<{ config: MobileAppConfig }>({
    path: '/api/v1/mobile/app-config',
  });
}
