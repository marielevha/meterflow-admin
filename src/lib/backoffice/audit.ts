import { Prisma, ReadingEventType, ReadingStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gpsThresholdMeters, resolveGpsThresholdMeters, haversineMeters } from "@/lib/geo/gps";
import { getAppSettings } from "@/lib/settings/serverSettings";

type StaffUser = {
  id: string;
  role: UserRole;
};

function toNumberOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export async function runReadingChecks(staff: StaffUser, readingId: string) {
  const appSettings = await getAppSettings();
  const reading = await prisma.reading.findFirst({
    where: { id: readingId, deletedAt: null },
    include: {
      meter: {
        select: {
          id: true,
          type: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  const latestState = await prisma.meterState.findFirst({
    where: {
      meterId: reading.meterId,
      deletedAt: null,
    },
    orderBy: { effectiveAt: "desc" },
    select: {
      currentPrimary: true,
      currentSecondary: true,
      effectiveAt: true,
    },
  });

  const checks: Array<{
    check: string;
    passed: boolean;
    details: Record<string, unknown>;
  }> = [];

  const primaryCurrent = toNumberOrNull(reading.primaryIndex);
  const secondaryCurrent = toNumberOrNull(reading.secondaryIndex);
  const primaryPrevious = toNumberOrNull(latestState?.currentPrimary);
  const secondaryPrevious = toNumberOrNull(latestState?.currentSecondary);

  const primaryPassed =
    primaryCurrent !== null && (primaryPrevious === null ? true : primaryCurrent >= primaryPrevious);
  checks.push({
    check: "primary_index_monotonic",
    passed: primaryPassed,
    details: {
      previous: primaryPrevious,
      current: primaryCurrent,
      referenceEffectiveAt: latestState?.effectiveAt?.toISOString() ?? null,
    },
  });

  if (reading.meter.type === "DUAL_INDEX") {
    const secondaryPassed =
      secondaryCurrent !== null &&
      (secondaryPrevious === null ? true : secondaryCurrent >= secondaryPrevious);
    checks.push({
      check: "secondary_index_monotonic",
      passed: secondaryPassed,
      details: {
        previous: secondaryPrevious,
        current: secondaryCurrent,
        referenceEffectiveAt: latestState?.effectiveAt?.toISOString() ?? null,
      },
    });
  }

  const meterLat = toNumberOrNull(reading.meter.latitude);
  const meterLng = toNumberOrNull(reading.meter.longitude);
  const readLat = toNumberOrNull(reading.gpsLatitude);
  const readLng = toNumberOrNull(reading.gpsLongitude);

  let distanceMeters: number | null = null;
  const threshold = resolveGpsThresholdMeters(appSettings.maxGpsDistanceMeters);
  let gpsPassed = true;

  if (
    meterLat !== null &&
    meterLng !== null &&
    readLat !== null &&
    readLng !== null
  ) {
    distanceMeters = haversineMeters(meterLat, meterLng, readLat, readLng);
    gpsPassed = distanceMeters <= threshold;
  }

  checks.push({
    check: "gps_distance",
    passed: gpsPassed,
    details: {
      meterLatitude: meterLat,
      meterLongitude: meterLng,
      readingLatitude: readLat,
      readingLongitude: readLng,
      distanceMeters,
      thresholdMeters: threshold,
    },
  });

  const failedChecks = checks.filter((c) => !c.passed);
  const suspicious = failedChecks.length > 0;

  const flagReason = suspicious
    ? failedChecks.map((c) => c.check).join(", ")
    : null;
  const anomalyPayload: Prisma.InputJsonObject = {
    suspicious,
    checks: checks as unknown as Prisma.InputJsonArray,
  };

  const result = await prisma.$transaction(async (tx) => {
    const updatedReading = await tx.reading.update({
      where: { id: reading.id },
      data: {
        gpsDistanceMeters: distanceMeters !== null ? new Prisma.Decimal(distanceMeters) : null,
        ...(suspicious && reading.status === ReadingStatus.PENDING
          ? {
              status: ReadingStatus.FLAGGED,
              flagReason,
              reviewedById: staff.id,
              reviewedAt: new Date(),
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        gpsDistanceMeters: true,
        flagReason: true,
        reviewedById: true,
        reviewedAt: true,
        updatedAt: true,
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.ANOMALY_DETECTED,
        payload: anomalyPayload,
      },
    });

    return updatedReading;
  });

  return {
    status: 200,
    body: {
      message: "checks_completed",
      suspicious,
      failedChecks: failedChecks.map((c) => c.check),
      checks,
      reading: result,
    },
  };
}

export async function getReadingEvents(readingId: string) {
  const reading = await prisma.reading.findFirst({
    where: { id: readingId, deletedAt: null },
    select: { id: true, status: true, meterId: true, createdAt: true, updatedAt: true },
  });

  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  const events = await prisma.readingEvent.findMany({
    where: { readingId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
      user: {
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
      reading,
      events,
    },
  };
}

export async function listAlerts(params: { from?: string; to?: string }) {
  const appSettings = await getAppSettings();
  const threshold = resolveGpsThresholdMeters(appSettings.maxGpsDistanceMeters);
  const where: Prisma.ReadingWhereInput = {
    deletedAt: null,
    OR: [
      { status: ReadingStatus.FLAGGED },
      { status: ReadingStatus.REJECTED },
      { flagReason: { not: null } },
      { anomalyScore: { not: null } },
      { gpsDistanceMeters: { gt: new Prisma.Decimal(threshold) } },
    ],
  };

  if (params.from || params.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (params.from) {
      const fromDate = new Date(params.from);
      if (Number.isNaN(fromDate.getTime())) {
        return { status: 400, body: { error: "invalid_from" } };
      }
      createdAt.gte = fromDate;
    }
    if (params.to) {
      const toDate = new Date(params.to);
      if (Number.isNaN(toDate.getTime())) {
        return { status: 400, body: { error: "invalid_to" } };
      }
      createdAt.lte = toDate;
    }
    where.createdAt = createdAt;
  }

  const alerts = await prisma.reading.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      flagReason: true,
      rejectionReason: true,
      anomalyScore: true,
      gpsDistanceMeters: true,
      updatedAt: true,
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          city: true,
          zone: true,
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
    take: 200,
  });

  return { status: 200, body: { alerts } };
}
