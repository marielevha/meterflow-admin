import {
  Prisma,
  ReadingEventType,
  ReadingStatus,
  TaskEventType,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import {
  createAgentTaskEvent,
  sendPushNotificationForAgentTaskEvent,
} from "@/lib/agentMobile/notifications";
import { prisma } from "@/lib/prisma";
import { activeMeterAssignmentCustomerSelect } from "@/lib/meters/assignments";
import { sendPushNotificationToUser } from "@/lib/notifications/expoPush";
import {
  getClientReadingDecisionMessage,
  getClientReadingDecisionTitle,
  normalizeFlagReasonCode,
  normalizeRejectionReasonCode,
} from "@/lib/readings/reviewReasons";

type StaffUser = {
  id: string;
  role: UserRole;
};

type FlagOrRejectPayload = {
  reason?: string;
};

type CreateTaskPayload = {
  title?: string;
  description?: string;
  assignedToId?: string;
  dueAt?: string;
  priority?: TaskPriority;
  type?: TaskType;
};

const REVIEWABLE_STATUSES = new Set<ReadingStatus>([
  ReadingStatus.PENDING,
  ReadingStatus.FLAGGED,
  ReadingStatus.RESUBMISSION_REQUESTED,
]);

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toTaskPriority(value: unknown): TaskPriority {
  return Object.values(TaskPriority).includes(value as TaskPriority)
    ? (value as TaskPriority)
    : TaskPriority.MEDIUM;
}

function toTaskType(value: unknown): TaskType {
  return Object.values(TaskType).includes(value as TaskType)
    ? (value as TaskType)
    : TaskType.FIELD_RECHECK;
}

async function getOwnedReadingForReview(readingId: string) {
  return prisma.reading.findFirst({
    where: {
      id: readingId,
      deletedAt: null,
    },
    include: {
      meter: {
        select: {
          id: true,
          type: true,
          serialNumber: true,
        },
      },
    },
  });
}

function buildReadingSummary(reading: {
  id: string;
  status: ReadingStatus;
  meterId: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  flagReason: string | null;
  updatedAt: Date;
}) {
  return {
    id: reading.id,
    status: reading.status,
    meterId: reading.meterId,
    reviewedById: reading.reviewedById,
    reviewedAt: reading.reviewedAt,
    rejectionReason: reading.rejectionReason,
    flagReason: reading.flagReason,
    updatedAt: reading.updatedAt,
  };
}

async function notifyReadingDecision(params: {
  userId: string;
  readingId: string;
  status: ReadingStatus;
  reason?: string | null;
  meterSerialNumber: string;
}) {
  const title = getClientReadingDecisionTitle(params.status, params.reason);
  const body = getClientReadingDecisionMessage(
    params.status,
    params.reason,
    params.meterSerialNumber
  );

  if (!title || !body) return;

  try {
    await sendPushNotificationToUser({
      userId: params.userId,
      title,
      body,
      data: {
        readingId: params.readingId,
        status: params.status,
        meterSerialNumber: params.meterSerialNumber,
      },
    });
  } catch {
    // best effort only, the review action must not fail on push delivery errors
  }
}

export async function listPendingReadings() {
  const readings = await prisma.reading.findMany({
    where: {
      deletedAt: null,
      status: ReadingStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      source: true,
      readingAt: true,
      primaryIndex: true,
      secondaryIndex: true,
      imageUrl: true,
      gpsLatitude: true,
      gpsLongitude: true,
      gpsAccuracyMeters: true,
      createdAt: true,
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          type: true,
          city: true,
          zone: true,
          ...activeMeterAssignmentCustomerSelect,
        },
      },
      submittedBy: {
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

  return { status: 200, body: { readings } };
}

export async function validateReading(staff: StaffUser, readingId: string) {
  const reading = await getOwnedReadingForReview(readingId);
  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  if (!REVIEWABLE_STATUSES.has(reading.status)) {
    return { status: 409, body: { error: "reading_not_reviewable" } };
  }

  const latestState = await prisma.meterState.findFirst({
    where: { meterId: reading.meterId, deletedAt: null },
    orderBy: { effectiveAt: "desc" },
    select: {
      currentPrimary: true,
      currentSecondary: true,
    },
  });

  if (latestState?.currentPrimary && reading.primaryIndex.lt(latestState.currentPrimary)) {
    return { status: 409, body: { error: "primary_index_not_monotonic" } };
  }

  if (
    reading.secondaryIndex &&
    latestState?.currentSecondary &&
    reading.secondaryIndex.lt(latestState.currentSecondary)
  ) {
    return { status: 409, body: { error: "secondary_index_not_monotonic" } };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reading.update({
      where: { id: reading.id },
      data: {
        status: ReadingStatus.VALIDATED,
        reviewedById: staff.id,
        reviewedAt: new Date(),
        rejectionReason: null,
        flagReason: null,
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.VALIDATED,
        payload: {
          byRole: staff.role,
          clientTitle: getClientReadingDecisionTitle(
            ReadingStatus.VALIDATED,
            null
          ),
          clientMessage: getClientReadingDecisionMessage(
            ReadingStatus.VALIDATED,
            null,
            reading.meter.serialNumber
          ),
        },
      },
    });

    await tx.meterState.create({
      data: {
        meterId: reading.meterId,
        sourceReadingId: reading.id,
        previousPrimary: latestState?.currentPrimary ?? null,
        previousSecondary: latestState?.currentSecondary ?? null,
        currentPrimary: reading.primaryIndex,
        currentSecondary: reading.secondaryIndex ?? null,
        effectiveAt: reading.readingAt,
      },
    });

    return updated;
  });

  await notifyReadingDecision({
    userId: reading.submittedById,
    readingId: reading.id,
    status: ReadingStatus.VALIDATED,
    reason: null,
    meterSerialNumber: reading.meter.serialNumber,
  });

  return { status: 200, body: { message: "reading_validated", reading: buildReadingSummary(result) } };
}

export async function flagReading(staff: StaffUser, readingId: string, payload: FlagOrRejectPayload) {
  const rawReason = toNullableTrimmed(payload.reason);
  if (!rawReason) {
    return { status: 400, body: { error: "flag_reason_required" } };
  }
  const reason = normalizeFlagReasonCode(rawReason);
  if (!reason) {
    return { status: 400, body: { error: "invalid_flag_reason" } };
  }

  const reading = await getOwnedReadingForReview(readingId);
  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  if (!REVIEWABLE_STATUSES.has(reading.status)) {
    return { status: 409, body: { error: "reading_not_reviewable" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const readingUpdated = await tx.reading.update({
      where: { id: reading.id },
      data: {
        status: ReadingStatus.FLAGGED,
        reviewedById: staff.id,
        reviewedAt: new Date(),
        flagReason: reason,
        rejectionReason: null,
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.FLAGGED,
        payload: {
          reason,
          byRole: staff.role,
          clientTitle: getClientReadingDecisionTitle(ReadingStatus.FLAGGED, reason),
          clientMessage: getClientReadingDecisionMessage(
            ReadingStatus.FLAGGED,
            reason,
            reading.meter.serialNumber
          ),
        },
      },
    });

    return readingUpdated;
  });

  await notifyReadingDecision({
    userId: reading.submittedById,
    readingId: reading.id,
    status: ReadingStatus.FLAGGED,
    reason,
    meterSerialNumber: reading.meter.serialNumber,
  });

  return { status: 200, body: { message: "reading_flagged", reading: buildReadingSummary(updated) } };
}

export async function rejectReading(
  staff: StaffUser,
  readingId: string,
  payload: FlagOrRejectPayload
) {
  const rawReason = toNullableTrimmed(payload.reason);
  if (!rawReason) {
    return { status: 400, body: { error: "rejection_reason_required" } };
  }
  const reason = normalizeRejectionReasonCode(rawReason);
  if (!reason) {
    return { status: 400, body: { error: "invalid_rejection_reason" } };
  }

  const reading = await getOwnedReadingForReview(readingId);
  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  if (!REVIEWABLE_STATUSES.has(reading.status)) {
    return { status: 409, body: { error: "reading_not_reviewable" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const readingUpdated = await tx.reading.update({
      where: { id: reading.id },
      data: {
        status: ReadingStatus.REJECTED,
        reviewedById: staff.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
        flagReason: null,
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.REJECTED,
        payload: {
          reason,
          byRole: staff.role,
          clientTitle: getClientReadingDecisionTitle(ReadingStatus.REJECTED, reason),
          clientMessage: getClientReadingDecisionMessage(
            ReadingStatus.REJECTED,
            reason,
            reading.meter.serialNumber
          ),
        },
      },
    });

    return readingUpdated;
  });

  await notifyReadingDecision({
    userId: reading.submittedById,
    readingId: reading.id,
    status: ReadingStatus.REJECTED,
    reason,
    meterSerialNumber: reading.meter.serialNumber,
  });

  return { status: 200, body: { message: "reading_rejected", reading: buildReadingSummary(updated) } };
}

export async function createReadingTask(
  staff: StaffUser,
  readingId: string,
  payload: CreateTaskPayload
) {
  const reading = await prisma.reading.findFirst({
    where: { id: readingId, deletedAt: null },
    select: {
      id: true,
      meterId: true,
      status: true,
      meter: {
        select: {
          serialNumber: true,
          assignedAgentId: true,
        },
      },
    },
  });

  if (!reading) {
    return { status: 404, body: { error: "reading_not_found" } };
  }

  const assignedToId = toNullableTrimmed(payload.assignedToId) ?? reading.meter.assignedAgentId;
  const title =
    toNullableTrimmed(payload.title) ??
    `Field recheck for meter ${reading.meter.serialNumber} (${reading.id})`;
  const description = toNullableTrimmed(payload.description);
  const priority = toTaskPriority(payload.priority);
  const type = toTaskType(payload.type);

  let dueAt: Date | null = null;
  if (payload.dueAt) {
    const parsedDueAt = new Date(payload.dueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return { status: 400, body: { error: "invalid_due_at" } };
    }
    dueAt = parsedDueAt;
  }

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!assignee) {
      return { status: 400, body: { error: "assigned_agent_not_found" } };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        meterId: reading.meterId,
        readingId: reading.id,
        assignedToId: assignedToId ?? null,
        createdById: staff.id,
        type,
        status: TaskStatus.OPEN,
        priority,
        title,
        description,
        dueAt,
      },
      select: {
        id: true,
        meterId: true,
        readingId: true,
        assignedToId: true,
        createdById: true,
        type: true,
        status: true,
        priority: true,
        title: true,
        description: true,
        dueAt: true,
        createdAt: true,
      },
    });

    await tx.readingEvent.create({
      data: {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.TASK_CREATED,
        payload: { taskId: task.id, type, priority, assignedToId: assignedToId ?? null },
      },
    });

    const agentEvent = await createAgentTaskEvent(tx, {
      taskId: task.id,
      type: TaskEventType.ASSIGNED,
      actorUserId: staff.id,
      recipientUserId: assignedToId ?? null,
      payload: {
        source: "reading-review",
        nextStatus: task.status,
      },
    });

    return {
      task,
      pushEventId: agentEvent?.id ?? null,
    };
  });

  if (created.pushEventId) {
    await sendPushNotificationForAgentTaskEvent(created.pushEventId);
  }

  return { status: 201, body: { message: "task_created", task: created.task } };
}
