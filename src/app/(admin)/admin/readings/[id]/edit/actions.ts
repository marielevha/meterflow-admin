"use server";

import { Prisma, ReadingEventType, ReadingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { sendPushNotificationToUser } from "@/lib/notifications/expoPush";
import { prisma } from "@/lib/prisma";
import {
  getClientReadingDecisionMessage,
  getClientReadingDecisionTitle,
  normalizeFlagReasonCode,
  normalizeRejectionReasonCode,
} from "@/lib/readings/reviewReasons";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseStatus(value: string): ReadingStatus | null {
  return Object.values(ReadingStatus).includes(value as ReadingStatus)
    ? (value as ReadingStatus)
    : null;
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

type DecisionStatus = "VALIDATED" | "FLAGGED" | "REJECTED";

type PushPayload = {
  userId: string;
  title: string;
  body: string;
  status: DecisionStatus;
  meterSerialNumber: string;
};

export async function updateReadingAction(readingId: string, formData: FormData) {
  const staff = await requireAdminPermissions(`/admin/readings/${readingId}/edit`, [
    ...ADMIN_PERMISSION_GROUPS.readingsUpdate,
    ...ADMIN_PERMISSION_GROUPS.readingsValidate,
    ...ADMIN_PERMISSION_GROUPS.readingsFlag,
    ...ADMIN_PERMISSION_GROUPS.readingsReject,
  ]);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canUpdateReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsUpdate);
  const canValidateReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsValidate);
  const canFlagReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsFlag);
  const canRejectReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsReject);
  const canEditGps = canUpdateReading;

  const status = parseStatus(asString(formData.get("status")));
  const primaryIndex = parseDecimal(asString(formData.get("primaryIndex")));
  const secondaryIndexRaw = asString(formData.get("secondaryIndex"));
  const secondaryIndex = secondaryIndexRaw ? parseDecimal(secondaryIndexRaw) : null;
  const gpsLatitudeRaw = asString(formData.get("gpsLatitude"));
  const gpsLongitudeRaw = asString(formData.get("gpsLongitude"));
  const gpsAccuracyRaw = asString(formData.get("gpsAccuracyMeters"));
  const gpsDistanceRaw = asString(formData.get("gpsDistanceMeters"));
  const gpsLatitude = gpsLatitudeRaw ? parseNumber(gpsLatitudeRaw) : null;
  const gpsLongitude = gpsLongitudeRaw ? parseNumber(gpsLongitudeRaw) : null;
  const gpsAccuracy = gpsAccuracyRaw ? parseDecimal(gpsAccuracyRaw) : null;
  const gpsDistance = gpsDistanceRaw ? parseDecimal(gpsDistanceRaw) : null;

  if (!status) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_status`);
  }

  if (primaryIndex === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_primary_index`);
  }

  if (secondaryIndexRaw && secondaryIndex === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_secondary_index`);
  }

  if (canEditGps && gpsLatitudeRaw && gpsLatitude === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_gps_latitude`);
  }

  if (canEditGps && gpsLongitudeRaw && gpsLongitude === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_gps_longitude`);
  }

  if (canEditGps && gpsAccuracyRaw && gpsAccuracy === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_gps_accuracy`);
  }

  if (canEditGps && gpsDistanceRaw && gpsDistance === null) {
    redirect(`/admin/readings/${readingId}/edit?error=invalid_gps_distance`);
  }

  const flagReason = asString(formData.get("flagReason"));
  const rejectionReason = asString(formData.get("rejectionReason"));
  const normalizedFlagReason = flagReason ? normalizeFlagReasonCode(flagReason) : null;
  const normalizedRejectionReason = rejectionReason ? normalizeRejectionReasonCode(rejectionReason) : null;

  const existing = await prisma.reading.findFirst({
    where: { id: readingId, deletedAt: null },
    select: {
      id: true,
      status: true,
      primaryIndex: true,
      secondaryIndex: true,
      gpsLatitude: true,
      gpsLongitude: true,
      gpsAccuracyMeters: true,
      gpsDistanceMeters: true,
      flagReason: true,
      rejectionReason: true,
      meter: {
        select: {
          customerId: true,
          serialNumber: true,
        },
      },
    },
  });

  if (!existing) {
    redirect(`/admin/readings?error=reading_not_found`);
  }

  const indexesChanged =
    existing.primaryIndex.toString() !== primaryIndex.toString() ||
    (existing.secondaryIndex ? existing.secondaryIndex.toString() : null) !==
      (secondaryIndex === null ? null : secondaryIndex.toString());
  const gpsChanged =
    (existing.gpsLatitude ? existing.gpsLatitude.toString() : null) !==
      (gpsLatitude === null ? null : gpsLatitude.toString()) ||
    (existing.gpsLongitude ? existing.gpsLongitude.toString() : null) !==
      (gpsLongitude === null ? null : gpsLongitude.toString()) ||
    (existing.gpsAccuracyMeters ? existing.gpsAccuracyMeters.toString() : null) !==
      (gpsAccuracy === null ? null : gpsAccuracy.toString()) ||
    (existing.gpsDistanceMeters ? existing.gpsDistanceMeters.toString() : null) !==
      (gpsDistance === null ? null : gpsDistance.toString());
  const effectiveFlagReason = status === ReadingStatus.FLAGGED ? normalizedFlagReason : null;
  const effectiveRejectionReason =
    status === ReadingStatus.REJECTED ? normalizedRejectionReason : null;
  const reasonChanged =
    existing.flagReason !== effectiveFlagReason ||
    existing.rejectionReason !== effectiveRejectionReason;

  if ((indexesChanged || gpsChanged) && !canUpdateReading) {
    redirect(`/admin/readings/${readingId}/edit?error=missing_permission`);
  }

  if (
    status === ReadingStatus.VALIDATED &&
    (existing.status !== ReadingStatus.VALIDATED || reasonChanged) &&
    !canValidateReading
  ) {
    redirect(`/admin/readings/${readingId}/edit?error=missing_permission`);
  }

  if (
    status === ReadingStatus.FLAGGED &&
    (existing.status !== ReadingStatus.FLAGGED || reasonChanged) &&
    !canFlagReading
  ) {
    redirect(`/admin/readings/${readingId}/edit?error=missing_permission`);
  }

  if (
    status === ReadingStatus.REJECTED &&
    (existing.status !== ReadingStatus.REJECTED || reasonChanged) &&
    !canRejectReading
  ) {
    redirect(`/admin/readings/${readingId}/edit?error=missing_permission`);
  }

  if (status === ReadingStatus.FLAGGED && !normalizedFlagReason) {
    redirect(
      `/admin/readings/${readingId}/edit?error=${
        flagReason ? "invalid_flag_reason" : "flag_reason_required"
      }`
    );
  }

  if (status === ReadingStatus.REJECTED && !normalizedRejectionReason) {
    redirect(
      `/admin/readings/${readingId}/edit?error=${
        rejectionReason ? "invalid_rejection_reason" : "rejection_reason_required"
      }`
    );
  }

  const now = new Date();
  const isReviewed =
    status === ReadingStatus.VALIDATED ||
    status === ReadingStatus.FLAGGED ||
    status === ReadingStatus.REJECTED;

  const data: Prisma.ReadingUpdateInput = {
    status,
    primaryIndex: primaryIndex.toString(),
    secondaryIndex: secondaryIndex === null ? null : secondaryIndex.toString(),
    flagReason: status === ReadingStatus.FLAGGED ? normalizedFlagReason : null,
    rejectionReason: status === ReadingStatus.REJECTED ? normalizedRejectionReason : null,
    reviewedAt: isReviewed ? now : null,
    reviewedBy: isReviewed ? { connect: { id: staff.id } } : { disconnect: true },
  };

  if (canEditGps) {
    data.gpsLatitude = gpsLatitude === null ? null : new Prisma.Decimal(gpsLatitude);
    data.gpsLongitude = gpsLongitude === null ? null : new Prisma.Decimal(gpsLongitude);
    data.gpsAccuracyMeters = gpsAccuracy === null ? null : new Prisma.Decimal(gpsAccuracy);
    data.gpsDistanceMeters = gpsDistance === null ? null : new Prisma.Decimal(gpsDistance);
  }

  try {
    const pushPayloadRef: { current: PushPayload | null } = { current: null };

    await prisma.$transaction(async (tx) => {
      await tx.reading.update({
        where: { id: readingId },
        data,
      });

      const changes = {
        status: { from: existing.status, to: status },
        primaryIndex: {
          from: existing.primaryIndex.toString(),
          to: primaryIndex.toString(),
        },
        secondaryIndex: {
          from: existing.secondaryIndex ? existing.secondaryIndex.toString() : null,
          to: secondaryIndex === null ? null : secondaryIndex.toString(),
        },
        ...(canEditGps
          ? {
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
            }
          : {}),
        flagReason: {
          from: existing.flagReason,
          to: status === ReadingStatus.FLAGGED ? normalizedFlagReason : null,
        },
        rejectionReason: {
          from: existing.rejectionReason,
          to: status === ReadingStatus.REJECTED ? normalizedRejectionReason : null,
        },
      };

      await tx.readingEvent.create({
        data: {
          readingId,
          userId: staff.id,
          type: ReadingEventType.TASK_UPDATED,
          payload: {
            action: "reading_manual_edit",
            scope: canEditGps ? "review_decision_indexes_gps" : "review_decision_only",
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

      const effectiveReason =
        status === ReadingStatus.FLAGGED
          ? normalizedFlagReason
          : status === ReadingStatus.REJECTED
            ? normalizedRejectionReason
            : null;
      const shouldCreateDecisionEvent =
        (status === ReadingStatus.VALIDATED && existing.status !== ReadingStatus.VALIDATED) ||
        (status === ReadingStatus.FLAGGED &&
          (existing.status !== ReadingStatus.FLAGGED ||
            existing.flagReason !== normalizedFlagReason)) ||
        (status === ReadingStatus.REJECTED &&
          (existing.status !== ReadingStatus.REJECTED ||
            existing.rejectionReason !== normalizedRejectionReason));

      if (shouldCreateDecisionEvent) {
        const decisionStatus = status as DecisionStatus;
        const decisionEventType =
          decisionStatus === ReadingStatus.VALIDATED
            ? ReadingEventType.VALIDATED
            : decisionStatus === ReadingStatus.FLAGGED
              ? ReadingEventType.FLAGGED
              : ReadingEventType.REJECTED;

        await tx.readingEvent.create({
          data: {
            readingId,
            userId: staff.id,
            type: decisionEventType,
            payload: {
              source: "admin_edit",
              editedById: staff.id,
              editedByRole: staff.role,
              reason: effectiveReason,
              clientTitle: getClientReadingDecisionTitle(decisionStatus, effectiveReason),
              clientMessage: getClientReadingDecisionMessage(
                decisionStatus,
                effectiveReason,
                existing.meter.serialNumber
              ),
            },
          },
        });

        const clientTitle = getClientReadingDecisionTitle(decisionStatus, effectiveReason);
        const clientMessage = getClientReadingDecisionMessage(
          decisionStatus,
          effectiveReason,
          existing.meter.serialNumber
        );

        if (clientTitle && clientMessage) {
          pushPayloadRef.current = {
            userId: existing.meter.customerId,
            title: clientTitle,
            body: clientMessage,
            status: decisionStatus,
            meterSerialNumber: existing.meter.serialNumber,
          };
        }
      }
    });

    const finalPushPayload = pushPayloadRef.current;
    if (finalPushPayload) {
      await sendPushNotificationToUser({
        userId: existing.meter.customerId,
        title: finalPushPayload.title,
        body: finalPushPayload.body,
        data: {
          readingId,
          status: finalPushPayload.status,
          meterSerialNumber: finalPushPayload.meterSerialNumber,
        },
      });
    }
  } catch {
    redirect(`/admin/readings/${readingId}/edit?error=update_failed`);
  }

  revalidatePath("/admin/readings");
  revalidatePath(`/admin/readings/${readingId}`);
  redirect(`/admin/readings/${readingId}?updated=1`);
}
