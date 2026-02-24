"use server";

import { Prisma, ReadingEventType, ReadingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { prisma } from "@/lib/prisma";
import { isReadingTransitionAllowed } from "@/lib/workflows/stateMachines";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDecimal(value: string) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseNumber(value: string) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function parseStatus(value: string): ReadingStatus | null {
  return Object.values(ReadingStatus).includes(value as ReadingStatus)
    ? (value as ReadingStatus)
    : null;
}

export async function updateReadingAction(readingId: string, formData: FormData) {
  const staff = await getCurrentStaffFromServerAction();
  if (!staff) redirect("/signin");

  const status = parseStatus(asString(formData.get("status")));
  const readingAt = parseDate(asString(formData.get("readingAt")));
  const primaryIndex = parseDecimal(asString(formData.get("primaryIndex")));
  const secondaryIndexRaw = asString(formData.get("secondaryIndex"));
  const secondaryIndex = secondaryIndexRaw ? parseDecimal(secondaryIndexRaw) : null;

  if (!status) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_status`);
  }

  if (!readingAt) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_reading_date`);
  }

  if (primaryIndex === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_primary_index`);
  }

  if (secondaryIndexRaw && secondaryIndex === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_secondary_index`);
  }

  const imageUrl = asString(formData.get("imageUrl"));
  if (!imageUrl) {
    redirect(`/admin/readings/${readingId}/edit?error=image_url_required`);
  }

  const flagReason = asString(formData.get("flagReason"));
  const rejectionReason = asString(formData.get("rejectionReason"));

  const gpsLatitudeRaw = asString(formData.get("gpsLatitude"));
  const gpsLongitudeRaw = asString(formData.get("gpsLongitude"));
  const gpsAccuracyRaw = asString(formData.get("gpsAccuracyMeters"));
  const gpsDistanceRaw = asString(formData.get("gpsDistanceMeters"));
  const confidenceRaw = asString(formData.get("confidenceScore"));
  const anomalyRaw = asString(formData.get("anomalyScore"));

  const gpsLatitude = gpsLatitudeRaw ? parseNumber(gpsLatitudeRaw) : null;
  const gpsLongitude = gpsLongitudeRaw ? parseNumber(gpsLongitudeRaw) : null;
  const gpsAccuracy = gpsAccuracyRaw ? parseDecimal(gpsAccuracyRaw) : null;
  const gpsDistance = gpsDistanceRaw ? parseDecimal(gpsDistanceRaw) : null;
  const confidenceScore = confidenceRaw ? parseDecimal(confidenceRaw) : null;
  const anomalyScore = anomalyRaw ? parseDecimal(anomalyRaw) : null;

  const existing = await prisma.reading.findFirst({
    where: { id: readingId, deletedAt: null },
    select: {
      id: true,
      meterId: true,
      status: true,
      primaryIndex: true,
      secondaryIndex: true,
      readingAt: true,
      imageUrl: true,
      gpsLatitude: true,
      gpsLongitude: true,
      gpsAccuracyMeters: true,
      gpsDistanceMeters: true,
      confidenceScore: true,
      anomalyScore: true,
      flagReason: true,
      rejectionReason: true,
    },
  });

  if (!existing) {
    redirect(`/admin/readings?error=reading_not_found`);
  }

  if (!isReadingTransitionAllowed(staff.role, existing.status, status)) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_status_transition`);
  }

  const now = new Date();
  const isReviewed = [ReadingStatus.VALIDATED, ReadingStatus.FLAGGED, ReadingStatus.REJECTED].includes(status);

  const data: Prisma.ReadingUpdateInput = {
    status,
    readingAt,
    primaryIndex: new Prisma.Decimal(primaryIndex),
    secondaryIndex: secondaryIndex === null ? null : new Prisma.Decimal(secondaryIndex),
    imageUrl,
    flagReason: status === ReadingStatus.FLAGGED ? (flagReason || null) : null,
    rejectionReason: status === ReadingStatus.REJECTED ? (rejectionReason || null) : null,
    gpsLatitude: gpsLatitude === null ? null : new Prisma.Decimal(gpsLatitude),
    gpsLongitude: gpsLongitude === null ? null : new Prisma.Decimal(gpsLongitude),
    gpsAccuracyMeters: gpsAccuracy === null ? null : new Prisma.Decimal(gpsAccuracy),
    gpsDistanceMeters: gpsDistance === null ? null : new Prisma.Decimal(gpsDistance),
    confidenceScore: confidenceScore === null ? null : new Prisma.Decimal(confidenceScore),
    anomalyScore: anomalyScore === null ? null : new Prisma.Decimal(anomalyScore),
    reviewedAt: isReviewed ? now : null,
    reviewedBy: isReviewed ? { connect: { id: staff.id } } : { disconnect: true },
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.reading.update({
        where: { id: readingId },
        data,
      });

      const changes = {
        status: { from: existing.status, to: status },
        readingAt: { from: existing.readingAt.toISOString(), to: readingAt.toISOString() },
        primaryIndex: { from: existing.primaryIndex.toString(), to: primaryIndex.toString() },
        secondaryIndex: {
          from: existing.secondaryIndex ? existing.secondaryIndex.toString() : null,
          to: secondaryIndex === null ? null : secondaryIndex.toString(),
        },
        imageUrl: { from: existing.imageUrl, to: imageUrl },
        gpsLatitude: {
          from: existing.gpsLatitude ? existing.gpsLatitude.toString() : null,
          to: gpsLatitude === null ? null : gpsLatitude.toString(),
        },
        gpsLongitude: {
          from: existing.gpsLongitude ? existing.gpsLongitude.toString() : null,
          to: gpsLongitude === null ? null : gpsLongitude.toString(),
        },
        gpsAccuracyMeters: {
          from: existing.gpsAccuracyMeters ? existing.gpsAccuracyMeters.toString() : null,
          to: gpsAccuracy === null ? null : gpsAccuracy.toString(),
        },
        gpsDistanceMeters: {
          from: existing.gpsDistanceMeters ? existing.gpsDistanceMeters.toString() : null,
          to: gpsDistance === null ? null : gpsDistance.toString(),
        },
        confidenceScore: {
          from: existing.confidenceScore ? existing.confidenceScore.toString() : null,
          to: confidenceScore === null ? null : confidenceScore.toString(),
        },
        anomalyScore: {
          from: existing.anomalyScore ? existing.anomalyScore.toString() : null,
          to: anomalyScore === null ? null : anomalyScore.toString(),
        },
        flagReason: { from: existing.flagReason, to: status === ReadingStatus.FLAGGED ? flagReason || null : null },
        rejectionReason: {
          from: existing.rejectionReason,
          to: status === ReadingStatus.REJECTED ? rejectionReason || null : null,
        },
      };

      await tx.readingEvent.create({
        data: {
          readingId,
          userId: staff.id,
          type: ReadingEventType.TASK_UPDATED,
          payload: {
            action: "reading_manual_edit",
            source: "admin_edit",
            editedById: staff.id,
            editedByRole: staff.role,
            editedAt: now.toISOString(),
            statusTransition: {
              from: existing.status,
              to: status,
            },
            changes,
          },
        },
      });
    });
  } catch {
    redirect(`/admin/readings/${readingId}/edit?error=update_failed`);
  }

  revalidatePath("/admin/readings");
  revalidatePath(`/admin/readings/${readingId}`);
  redirect(`/admin/readings/${readingId}?updated=1`);
}
