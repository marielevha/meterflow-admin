import { BillingCampaignStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AppSettings } from "@/lib/settings/appSettings";
import { getAppSettings } from "@/lib/settings/serverSettings";
import {
  getReadingWindowBounds,
  isWithinReadingSubmissionWindow,
} from "@/lib/settings/readingReminderWindow";

type CampaignWindowCandidate = {
  id: string;
  code: string;
  name: string;
  status: BillingCampaignStatus;
  periodStart: Date;
  periodEnd: Date;
  submissionStartAt: Date | null;
  submissionEndAt: Date | null;
};

export type ClientReadingSubmissionWindow = {
  isOpen: boolean;
  windowStart: Date;
  windowEnd: Date;
  timeZone: string;
  startDay: number;
  endDay: number;
  submissionWindowKey: string;
  source: "settings" | "campaign";
  campaignId: string | null;
  campaignCode: string | null;
  campaignName: string | null;
};

function formatCampaignWindowKey(campaign: CampaignWindowCandidate, start: Date, end: Date) {
  return `campaign:${campaign.id}:${start.toISOString()}:${end.toISOString()}`;
}

function buildDefaultWindow(settings: AppSettings, date: Date): ClientReadingSubmissionWindow {
  const currentBounds = getReadingWindowBounds(date, settings);
  const isOpen = isWithinReadingSubmissionWindow(date, settings);

  let windowStart = currentBounds.windowStart;
  let windowEnd = currentBounds.windowEnd;
  let submissionWindowKey = currentBounds.reminderWindowKey;

  if (!isOpen && windowEnd.getTime() < date.getTime()) {
    const nextReferenceDate = new Date(windowStart);
    nextReferenceDate.setUTCDate(nextReferenceDate.getUTCDate() + 32);
    const nextBounds = getReadingWindowBounds(nextReferenceDate, settings);
    windowStart = nextBounds.windowStart;
    windowEnd = nextBounds.windowEnd;
    submissionWindowKey = nextBounds.reminderWindowKey;
  }

  return {
    isOpen,
    windowStart,
    windowEnd,
    timeZone: settings.readingReminderTimezone || "UTC",
    startDay: settings.readingWindowStartDay,
    endDay: settings.readingWindowEndDay,
    submissionWindowKey,
    source: "settings",
    campaignId: null,
    campaignCode: null,
    campaignName: null,
  };
}

function effectiveCampaignWindow(candidate: CampaignWindowCandidate) {
  return {
    windowStart: candidate.submissionStartAt ?? candidate.periodStart,
    windowEnd: candidate.submissionEndAt ?? candidate.periodEnd,
  };
}

function buildCampaignWindow(
  settings: AppSettings,
  candidate: CampaignWindowCandidate,
  date: Date
): ClientReadingSubmissionWindow {
  const { windowStart, windowEnd } = effectiveCampaignWindow(candidate);

  return {
    isOpen: date.getTime() >= windowStart.getTime() && date.getTime() <= windowEnd.getTime(),
    windowStart,
    windowEnd,
    timeZone: settings.readingReminderTimezone || "UTC",
    startDay: settings.readingWindowStartDay,
    endDay: settings.readingWindowEndDay,
    submissionWindowKey: formatCampaignWindowKey(candidate, windowStart, windowEnd),
    source: "campaign",
    campaignId: candidate.id,
    campaignCode: candidate.code,
    campaignName: candidate.name,
  };
}

function selectBestCampaignWindow(
  settings: AppSettings,
  candidates: CampaignWindowCandidate[],
  date: Date
): ClientReadingSubmissionWindow | null {
  if (!candidates.length) return null;

  const current = candidates
    .map((candidate) => ({ candidate, ...effectiveCampaignWindow(candidate) }))
    .filter(({ windowStart, windowEnd }) => date >= windowStart && date <= windowEnd)
    .sort((left, right) => {
      return (
        left.windowEnd.getTime() - right.windowEnd.getTime() ||
        right.windowStart.getTime() - left.windowStart.getTime()
      );
    });

  if (current[0]) {
    return buildCampaignWindow(settings, current[0].candidate, date);
  }

  const upcoming = candidates
    .map((candidate) => ({ candidate, ...effectiveCampaignWindow(candidate) }))
    .filter(({ windowStart }) => windowStart.getTime() > date.getTime())
    .sort((left, right) => {
      return (
        left.windowStart.getTime() - right.windowStart.getTime() ||
        left.windowEnd.getTime() - right.windowEnd.getTime()
      );
    });

  if (upcoming[0]) {
    return buildCampaignWindow(settings, upcoming[0].candidate, date);
  }

  return null;
}

export function serializeClientReadingSubmissionWindow(window: ClientReadingSubmissionWindow) {
  return {
    ...window,
    windowStart: window.windowStart.toISOString(),
    windowEnd: window.windowEnd.toISOString(),
  };
}

export function buildClientReadingSubmissionWindow(settings: AppSettings, date = new Date()) {
  return buildDefaultWindow(settings, date);
}

export async function resolveClientReadingSubmissionWindows(
  zoneIds: Array<string | null | undefined>,
  date = new Date()
) {
  const settings = await getAppSettings();
  const defaultWindow = buildDefaultWindow(settings, date);
  const normalizedZoneIds = Array.from(
    new Set(zoneIds.filter((zoneId): zoneId is string => Boolean(zoneId)))
  );

  if (!normalizedZoneIds.length) {
    return {
      defaultWindow,
      byZoneId: new Map<string, ClientReadingSubmissionWindow>(),
    };
  }

  const links = await prisma.billingCampaignZone.findMany({
    where: {
      deletedAt: null,
      zoneId: { in: normalizedZoneIds },
      campaign: {
        deletedAt: null,
        status: {
          notIn: [BillingCampaignStatus.DRAFT, BillingCampaignStatus.CANCELED],
        },
      },
    },
    select: {
      zoneId: true,
      campaign: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          submissionStartAt: true,
          submissionEndAt: true,
        },
      },
    },
  });

  const byZoneId = new Map<string, ClientReadingSubmissionWindow>();

  for (const zoneId of normalizedZoneIds) {
    const candidates = links
      .filter((link) => link.zoneId === zoneId)
      .map((link) => link.campaign);

    const campaignWindow = selectBestCampaignWindow(settings, candidates, date);
    byZoneId.set(zoneId, campaignWindow ?? defaultWindow);
  }

  return { defaultWindow, byZoneId };
}

export async function getClientReadingSubmissionWindow(date = new Date()) {
  const settings = await getAppSettings();
  return buildDefaultWindow(settings, date);
}

export async function getMeterReadingSubmissionWindow(
  zoneId: string | null | undefined,
  date = new Date()
) {
  const { defaultWindow, byZoneId } = await resolveClientReadingSubmissionWindows([zoneId], date);
  if (!zoneId) return defaultWindow;
  return byZoneId.get(zoneId) ?? defaultWindow;
}
