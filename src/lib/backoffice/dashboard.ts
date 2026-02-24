import { Prisma, ReadingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function asPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function gpsThresholdMeters() {
  const raw = Number(process.env.GPS_MAX_DISTANCE_METERS ?? "200");
  if (!Number.isFinite(raw) || raw <= 0) return 200;
  return raw;
}

function buildDateRangeFilter(from?: string, to?: string) {
  if (!from && !to) return { filter: undefined as Prisma.DateTimeFilter | undefined };

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) return { error: "invalid_from" as const };
    createdAt.gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) return { error: "invalid_to" as const };
    createdAt.lte = toDate;
  }
  return { filter: createdAt };
}

export async function getDashboardKpis(params: { from?: string; to?: string }) {
  const range = buildDateRangeFilter(params.from, params.to);
  if ("error" in range) {
    return { status: 400, body: { error: range.error } };
  }

  const baseWhere: Prisma.ReadingWhereInput = {
    deletedAt: null,
    ...(range.filter ? { createdAt: range.filter } : {}),
  };

  const [totalReadings, validatedCount, flaggedCount, rejectedCount, reviewedRows] =
    await Promise.all([
      prisma.reading.count({ where: baseWhere }),
      prisma.reading.count({ where: { ...baseWhere, status: ReadingStatus.VALIDATED } }),
      prisma.reading.count({ where: { ...baseWhere, status: ReadingStatus.FLAGGED } }),
      prisma.reading.count({ where: { ...baseWhere, status: ReadingStatus.REJECTED } }),
      prisma.reading.findMany({
        where: {
          ...baseWhere,
          reviewedAt: { not: null },
        },
        select: { createdAt: true, reviewedAt: true },
      }),
    ]);

  const delays = reviewedRows
    .map((row) => {
      if (!row.reviewedAt) return null;
      return (row.reviewedAt.getTime() - row.createdAt.getTime()) / 60000;
    })
    .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);

  const avgProcessingDelayMinutes =
    delays.length > 0
      ? Number((delays.reduce((sum, d) => sum + d, 0) / delays.length).toFixed(2))
      : 0;

  return {
    status: 200,
    body: {
      kpis: {
        totalReadings,
        validatedCount,
        flaggedCount,
        rejectedCount,
        validatedPercent: asPercent(validatedCount, totalReadings),
        flaggedPercent: asPercent(flaggedCount, totalReadings),
        rejectedPercent: asPercent(rejectedCount, totalReadings),
        avgProcessingDelayMinutes,
      },
    },
  };
}

export async function getDashboardTopAgents(params: { from?: string; to?: string }) {
  const range = buildDateRangeFilter(params.from, params.to);
  if ("error" in range) {
    return { status: 400, body: { error: range.error } };
  }

  const rows = await prisma.reading.groupBy({
    by: ["reviewedById"],
    where: {
      deletedAt: null,
      reviewedById: { not: null },
      status: { in: [ReadingStatus.VALIDATED, ReadingStatus.FLAGGED, ReadingStatus.REJECTED] },
      ...(range.filter ? { createdAt: range.filter } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { reviewedById: "desc" } },
    take: 10,
  });

  const reviewerIds = rows
    .map((r) => r.reviewedById)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const users = await prisma.user.findMany({
    where: { id: { in: reviewerIds }, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      city: true,
      zone: true,
    },
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const topAgents = rows.map((row, index) => ({
    rank: index + 1,
    reviewCount: row._count._all,
    agent: row.reviewedById ? userMap[row.reviewedById] ?? null : null,
  }));

  return { status: 200, body: { topAgents } };
}

export async function getDashboardGpsSuspicions(params: { from?: string; to?: string }) {
  const range = buildDateRangeFilter(params.from, params.to);
  if ("error" in range) {
    return { status: 400, body: { error: range.error } };
  }

  const threshold = gpsThresholdMeters();

  const suspicions = await prisma.reading.findMany({
    where: {
      deletedAt: null,
      ...(range.filter ? { createdAt: range.filter } : {}),
      OR: [
        { gpsDistanceMeters: { gt: new Prisma.Decimal(threshold) } },
        { flagReason: { contains: "gps_distance" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      gpsDistanceMeters: true,
      gpsAccuracyMeters: true,
      gpsLatitude: true,
      gpsLongitude: true,
      flagReason: true,
      readingAt: true,
      updatedAt: true,
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          city: true,
          zone: true,
          latitude: true,
          longitude: true,
        },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          phone: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      thresholdMeters: threshold,
      suspicions,
    },
  };
}
