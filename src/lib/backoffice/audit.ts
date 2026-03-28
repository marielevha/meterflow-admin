import { Prisma, ReadingEventType, ReadingStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveGpsThresholdMeters } from "@/lib/geo/gps";
import { getAppSettings } from "@/lib/settings/serverSettings";
import {
  buildReadingAnomalyPayload,
  evaluateReadingAnomalies,
} from "@/lib/readings/anomalyChecks";

type StaffUser = {
  id: string;
  role: UserRole;
};

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

  const evaluation = await evaluateReadingAnomalies({
    meterId: reading.meterId,
    meterType: reading.meter.type,
    readingAt: reading.readingAt,
    primaryIndex: reading.primaryIndex,
    secondaryIndex: reading.secondaryIndex,
    meterLatitude: reading.meter.latitude,
    meterLongitude: reading.meter.longitude,
    readingLatitude: reading.gpsLatitude,
    readingLongitude: reading.gpsLongitude,
    gpsThresholdMeters: resolveGpsThresholdMeters(appSettings.maxGpsDistanceMeters),
    excludeReadingId: reading.id,
  });

  const anomalyPayload = buildReadingAnomalyPayload(
    "backoffice_audit",
    evaluation
  ) as Prisma.InputJsonObject;

  const result = await prisma.$transaction(async (tx) => {
    const updatedReading = await tx.reading.update({
      where: { id: reading.id },
      data: {
        gpsDistanceMeters:
          evaluation.gpsDistanceMeters !== null
            ? new Prisma.Decimal(evaluation.gpsDistanceMeters)
            : null,
        ...(evaluation.suspicious && reading.status === ReadingStatus.PENDING
          ? {
              status: ReadingStatus.FLAGGED,
              flagReason: evaluation.preferredReasonCode,
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
      suspicious: evaluation.suspicious,
      failedChecks: evaluation.failedChecks,
      checks: evaluation.checks,
      referenceState: evaluation.referenceState,
      preferredReasonCode: evaluation.preferredReasonCode,
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
