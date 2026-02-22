import {
  MeterType,
  Prisma,
  ReadingEventType,
  ReadingSource,
  ReadingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateReadingPayload = {
  meterId?: string;
  readingAt?: string;
  primaryIndex?: string | number;
  secondaryIndex?: string | number | null;
  imageUrl?: string;
  imageHash?: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
  gpsLatitude?: string | number;
  gpsLongitude?: string | number;
  gpsAccuracyMeters?: string | number;
  idempotencyKey?: string;
};

type ResubmitReadingPayload = Omit<CreateReadingPayload, "meterId" | "idempotencyKey">;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDecimalInput(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

function parseReadingDate(value: unknown): Date {
  if (!value || typeof value !== "string") return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function normalizeIdempotency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isAllowedReadingStatus(value: string): value is ReadingStatus {
  return Object.values(ReadingStatus).includes(value as ReadingStatus);
}

export async function createClientReading(userId: string, payload: CreateReadingPayload) {
  const meterId = toNullableString(payload.meterId);
  const imageUrl = toNullableString(payload.imageUrl);
  const idempotencyKey = normalizeIdempotency(payload.idempotencyKey);
  const primaryIndex = toDecimalInput(payload.primaryIndex);
  const secondaryIndex = toDecimalInput(payload.secondaryIndex);
  const gpsLatitude = toDecimalInput(payload.gpsLatitude);
  const gpsLongitude = toDecimalInput(payload.gpsLongitude);
  const gpsAccuracyMeters = toDecimalInput(payload.gpsAccuracyMeters);
  const readingAt = parseReadingDate(payload.readingAt);

  if (!meterId || !imageUrl || !primaryIndex) {
    return { status: 400, body: { error: "meter_id_image_url_primary_index_required" } };
  }

  if (primaryIndex.lessThan(0)) {
    return { status: 400, body: { error: "primary_index_must_be_positive" } };
  }

  if (secondaryIndex && secondaryIndex.lessThan(0)) {
    return { status: 400, body: { error: "secondary_index_must_be_positive" } };
  }

  if (idempotencyKey) {
    const existingByIdempotency = await prisma.reading.findFirst({
      where: { idempotencyKey },
      select: { id: true, submittedById: true },
    });

    if (existingByIdempotency) {
      if (existingByIdempotency.submittedById !== userId) {
        return { status: 409, body: { error: "idempotency_key_conflict" } };
      }
      const existingReading = await prisma.reading.findFirst({
        where: { id: existingByIdempotency.id, deletedAt: null },
        include: {
          meter: { select: { id: true, serialNumber: true, meterReference: true, type: true } },
        },
      });
      return { status: 200, body: { message: "idempotent_replay", reading: existingReading } };
    }
  }

  const meter = await prisma.meter.findFirst({
    where: {
      id: meterId,
      customerId: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      serialNumber: true,
      meterReference: true,
    },
  });

  if (!meter) {
    return { status: 404, body: { error: "meter_not_found" } };
  }

  if (meter.type === MeterType.DUAL_INDEX && !secondaryIndex) {
    return { status: 400, body: { error: "secondary_index_required_for_dual_meter" } };
  }

  const created = await prisma.$transaction(async (tx) => {
    const reading = await tx.reading.create({
      data: {
        meterId: meter.id,
        submittedById: userId,
        source: ReadingSource.CLIENT,
        status: ReadingStatus.PENDING,
        readingAt,
        primaryIndex,
        secondaryIndex: meter.type === MeterType.DUAL_INDEX ? secondaryIndex : null,
        imageUrl,
        imageHash: toNullableString(payload.imageHash),
        imageMimeType: toNullableString(payload.imageMimeType),
        imageSizeBytes:
          typeof payload.imageSizeBytes === "number" && Number.isFinite(payload.imageSizeBytes)
            ? Math.max(0, Math.floor(payload.imageSizeBytes))
            : null,
        gpsLatitude,
        gpsLongitude,
        gpsAccuracyMeters,
        idempotencyKey,
      },
      include: {
        meter: { select: { id: true, serialNumber: true, meterReference: true, type: true } },
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId,
        type: ReadingEventType.CREATED,
        payload: { source: "mobile", status: ReadingStatus.PENDING },
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId,
        type: ReadingEventType.SUBMITTED,
        payload: { source: "mobile" },
      },
    });

    return reading;
  });

  return { status: 201, body: { message: "reading_created", reading: created } };
}

export async function listClientReadings(
  userId: string,
  params: { status?: string; dateFrom?: string; dateTo?: string }
) {
  let statusFilter: ReadingStatus | undefined;
  if (params.status && isAllowedReadingStatus(params.status)) {
    statusFilter = params.status;
  } else if (params.status) {
    return { status: 400, body: { error: "invalid_status_filter" } };
  }

  const where: Prisma.ReadingWhereInput = {
    submittedById: userId,
    deletedAt: null,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  if (params.dateFrom || params.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};

    if (params.dateFrom) {
      const parsedFrom = new Date(params.dateFrom);
      if (Number.isNaN(parsedFrom.getTime())) {
        return { status: 400, body: { error: "invalid_date_from" } };
      }
      dateFilter.gte = parsedFrom;
    }

    if (params.dateTo) {
      const parsedTo = new Date(params.dateTo);
      if (Number.isNaN(parsedTo.getTime())) {
        return { status: 400, body: { error: "invalid_date_to" } };
      }
      dateFilter.lte = parsedTo;
    }

    where.readingAt = dateFilter;
  }

  const readings = await prisma.reading.findMany({
    where,
    select: {
      id: true,
      meterId: true,
      status: true,
      source: true,
      readingAt: true,
      primaryIndex: true,
      secondaryIndex: true,
      imageUrl: true,
      rejectionReason: true,
      flagReason: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          type: true,
          city: true,
          zone: true,
        },
      },
    },
    orderBy: { readingAt: "desc" },
  });

  return { status: 200, body: { readings } };
}

export async function getClientReadingDetail(userId: string, readingId: string) {
  const reading = await prisma.reading.findFirst({
    where: {
      id: readingId,
      submittedById: userId,
      deletedAt: null,
    },
    include: {
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          type: true,
          city: true,
          zone: true,
          addressLine1: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
      events: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          payload: true,
          createdAt: true,
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
      },
    },
  });

  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  return { status: 200, body: { reading } };
}

export async function resubmitClientReading(
  userId: string,
  readingId: string,
  payload: ResubmitReadingPayload
) {
  const imageUrl = toNullableString(payload.imageUrl);
  const primaryIndex = toDecimalInput(payload.primaryIndex);
  const secondaryIndex = toDecimalInput(payload.secondaryIndex);
  const gpsLatitude = toDecimalInput(payload.gpsLatitude);
  const gpsLongitude = toDecimalInput(payload.gpsLongitude);
  const gpsAccuracyMeters = toDecimalInput(payload.gpsAccuracyMeters);
  const readingAt = parseReadingDate(payload.readingAt);

  if (!imageUrl || !primaryIndex) {
    return { status: 400, body: { error: "image_url_and_primary_index_required" } };
  }

  if (primaryIndex.lessThan(0)) {
    return { status: 400, body: { error: "primary_index_must_be_positive" } };
  }

  if (secondaryIndex && secondaryIndex.lessThan(0)) {
    return { status: 400, body: { error: "secondary_index_must_be_positive" } };
  }

  const existing = await prisma.reading.findFirst({
    where: {
      id: readingId,
      submittedById: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      meterId: true,
      status: true,
      meter: { select: { type: true } },
    },
  });

  if (!existing) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  if (
    existing.status !== ReadingStatus.REJECTED &&
    existing.status !== ReadingStatus.RESUBMISSION_REQUESTED
  ) {
    return { status: 409, body: { error: "reading_not_eligible_for_resubmission" } };
  }

  if (existing.meter.type === MeterType.DUAL_INDEX && !secondaryIndex) {
    return { status: 400, body: { error: "secondary_index_required_for_dual_meter" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reading = await tx.reading.update({
      where: { id: existing.id },
      data: {
        status: ReadingStatus.PENDING,
        source: ReadingSource.CLIENT,
        readingAt,
        primaryIndex,
        secondaryIndex: existing.meter.type === MeterType.DUAL_INDEX ? secondaryIndex : null,
        imageUrl,
        imageHash: toNullableString(payload.imageHash),
        imageMimeType: toNullableString(payload.imageMimeType),
        imageSizeBytes:
          typeof payload.imageSizeBytes === "number" && Number.isFinite(payload.imageSizeBytes)
            ? Math.max(0, Math.floor(payload.imageSizeBytes))
            : null,
        gpsLatitude,
        gpsLongitude,
        gpsAccuracyMeters,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        flagReason: null,
      },
      include: {
        meter: { select: { id: true, serialNumber: true, meterReference: true, type: true } },
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId,
        type: ReadingEventType.RESUBMITTED,
        payload: { source: "mobile" },
      },
    });

    return reading;
  });

  return { status: 200, body: { message: "reading_resubmitted", reading: updated } };
}
