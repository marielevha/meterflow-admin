import { MeterType, Prisma } from "@prisma/client";
import { haversineMeters } from "@/lib/geo/gps";
import { prisma } from "@/lib/prisma";
import { canonicalizeReviewReasonCode } from "@/lib/readings/reviewReasons";

export type ReadingAnomalyCheckName =
  | "primary_index_monotonic"
  | "secondary_index_monotonic"
  | "gps_distance";

export type ReadingAnomalyCheck = {
  check: ReadingAnomalyCheckName;
  passed: boolean | null;
  details: Record<string, string | number | boolean | null>;
};

export type ReadingReferenceState = {
  sourceReadingId: string | null;
  previousPrimary: number | null;
  previousSecondary: number | null;
  currentPrimary: number | null;
  currentSecondary: number | null;
  effectiveAt: string | null;
};

type EvaluateReadingAnomaliesParams = {
  meterId: string;
  meterType: MeterType;
  readingAt: Date;
  primaryIndex: Prisma.Decimal | null;
  secondaryIndex: Prisma.Decimal | null;
  meterLatitude: Prisma.Decimal | null;
  meterLongitude: Prisma.Decimal | null;
  readingLatitude: Prisma.Decimal | null;
  readingLongitude: Prisma.Decimal | null;
  gpsThresholdMeters: number;
  excludeReadingId?: string | null;
};

type MeterStateReader = Pick<typeof prisma, "meterState">;

function toNumberOrNull(value: Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value.toString());
  return Number.isFinite(numeric) ? numeric : null;
}

export async function evaluateReadingAnomalies(
  params: EvaluateReadingAnomaliesParams,
  db: MeterStateReader = prisma
) {
  const referenceState = await db.meterState.findFirst({
    where: {
      meterId: params.meterId,
      deletedAt: null,
      effectiveAt: {
        lte: params.readingAt,
      },
      ...(params.excludeReadingId
        ? {
            OR: [
              { sourceReadingId: null },
              {
                sourceReadingId: {
                  not: params.excludeReadingId,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: {
      sourceReadingId: true,
      previousPrimary: true,
      previousSecondary: true,
      currentPrimary: true,
      currentSecondary: true,
      effectiveAt: true,
    },
  });

  const reference: ReadingReferenceState | null = referenceState
    ? {
        sourceReadingId: referenceState.sourceReadingId,
        previousPrimary: toNumberOrNull(referenceState.previousPrimary),
        previousSecondary: toNumberOrNull(referenceState.previousSecondary),
        currentPrimary: toNumberOrNull(referenceState.currentPrimary),
        currentSecondary: toNumberOrNull(referenceState.currentSecondary),
        effectiveAt: referenceState.effectiveAt.toISOString(),
      }
    : null;

  const primaryCurrent = toNumberOrNull(params.primaryIndex);
  const secondaryCurrent = toNumberOrNull(params.secondaryIndex);
  const primaryPrevious = reference?.currentPrimary ?? null;
  const secondaryPrevious = reference?.currentSecondary ?? null;

  const checks: ReadingAnomalyCheck[] = [
    {
      check: "primary_index_monotonic",
      passed:
        primaryCurrent !== null &&
        (primaryPrevious === null ? true : primaryCurrent >= primaryPrevious),
      details: {
        previous: primaryPrevious,
        current: primaryCurrent,
        referenceEffectiveAt: reference?.effectiveAt ?? null,
      },
    },
  ];

  if (params.meterType === MeterType.DUAL_INDEX) {
    checks.push({
      check: "secondary_index_monotonic",
      passed:
        secondaryCurrent !== null &&
        (secondaryPrevious === null ? true : secondaryCurrent >= secondaryPrevious),
      details: {
        previous: secondaryPrevious,
        current: secondaryCurrent,
        referenceEffectiveAt: reference?.effectiveAt ?? null,
      },
    });
  }

  const meterLat = toNumberOrNull(params.meterLatitude);
  const meterLng = toNumberOrNull(params.meterLongitude);
  const readingLat = toNumberOrNull(params.readingLatitude);
  const readingLng = toNumberOrNull(params.readingLongitude);
  const gpsDistanceMeters =
    meterLat !== null && meterLng !== null && readingLat !== null && readingLng !== null
      ? haversineMeters(meterLat, meterLng, readingLat, readingLng)
      : null;

  checks.push({
    check: "gps_distance",
    passed: gpsDistanceMeters === null ? null : gpsDistanceMeters <= params.gpsThresholdMeters,
    details: {
      distanceMeters: gpsDistanceMeters,
      thresholdMeters: params.gpsThresholdMeters,
      meterLatitude: meterLat,
      meterLongitude: meterLng,
      readingLatitude: readingLat,
      readingLongitude: readingLng,
    },
  });

  const failedChecks = checks.filter((check) => check.passed === false);
  const failedCheckNames = failedChecks.map((check) => check.check);
  const preferredReasonCode = canonicalizeReviewReasonCode(
    failedCheckNames.some(
      (check) =>
        check === "primary_index_monotonic" || check === "secondary_index_monotonic"
    )
      ? "INDEX_INCONSISTENT"
      : failedCheckNames.includes("gps_distance")
        ? "GPS_MISMATCH"
        : null
  );

  return {
    suspicious: failedChecks.length > 0,
    checks,
    failedChecks: failedCheckNames,
    preferredReasonCode,
    referenceState: reference,
    gpsDistanceMeters,
  };
}

export function buildReadingAnomalyPayload(
  source: string,
  evaluation: Awaited<ReturnType<typeof evaluateReadingAnomalies>>
) {
  return {
    source,
    suspicious: evaluation.suspicious,
    preferredReasonCode: evaluation.preferredReasonCode,
    failedChecks: evaluation.failedChecks,
    referenceState: evaluation.referenceState,
    checks: evaluation.checks,
  };
}
