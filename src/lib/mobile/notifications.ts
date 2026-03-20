import { Prisma, ReadingEventType, ReadingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getClientReadingDecisionMessage,
  getClientReadingDecisionTitle,
  getReadingStatusLabel,
  getReviewReasonLabel,
} from "@/lib/readings/reviewReasons";

type NotificationPayload = {
  clientTitle?: unknown;
  clientMessage?: unknown;
  reason?: unknown;
};

type NotificationListOptions = {
  limit?: number;
  cursor?: string;
};

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapEventTypeToStatus(type: ReadingEventType): ReadingStatus | null {
  switch (type) {
    case ReadingEventType.VALIDATED:
      return ReadingStatus.VALIDATED;
    case ReadingEventType.FLAGGED:
      return ReadingStatus.FLAGGED;
    case ReadingEventType.REJECTED:
      return ReadingStatus.REJECTED;
    default:
      return null;
  }
}

function buildNotificationWhere(userId: string): Prisma.ReadingEventWhereInput {
  return {
    deletedAt: null,
    type: {
      in: [
        ReadingEventType.VALIDATED,
        ReadingEventType.FLAGGED,
        ReadingEventType.REJECTED,
      ],
    },
    reading: {
      submittedById: userId,
      deletedAt: null,
    },
  };
}

export async function listClientNotifications(
  userId: string,
  options?: NotificationListOptions
) {
  const where = buildNotificationWhere(userId);
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const queryCursor = toOptionalString(options?.cursor);

  const [events, unreadCount] = await Promise.all([
    prisma.readingEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(queryCursor
        ? {
            cursor: { id: queryCursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        type: true,
        createdAt: true,
        payload: true,
        notificationReads: {
          where: { userId },
          select: {
            readAt: true,
          },
          take: 1,
        },
        reading: {
          select: {
            id: true,
            status: true,
            flagReason: true,
            rejectionReason: true,
            meter: {
              select: {
                id: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    }),
    prisma.readingEvent.count({
      where: {
        ...where,
        notificationReads: {
          none: {
            userId,
          },
        },
      },
    }),
  ]);

  const hasMore = events.length > limit;
  const pageEvents = hasMore ? events.slice(0, limit) : events;

  const notifications = pageEvents.map((event) => {
    const payload = ((event.payload ?? {}) as NotificationPayload) || {};
    const fallbackStatus = mapEventTypeToStatus(event.type);
    const status = fallbackStatus ?? event.reading.status;
    const reasonCode =
      toOptionalString(payload.reason) ||
      event.reading.flagReason ||
      event.reading.rejectionReason;
    const title =
      toOptionalString(payload.clientTitle) ||
      getClientReadingDecisionTitle(status, reasonCode) ||
      "Notification";
    const body =
      toOptionalString(payload.clientMessage) ||
      getClientReadingDecisionMessage(
        status,
        reasonCode,
        event.reading.meter.serialNumber
      ) ||
      "Une mise à jour est disponible pour votre relevé.";

    return {
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      title,
      body,
      readingId: event.reading.id,
      meterId: event.reading.meter.id,
      meterSerialNumber: event.reading.meter.serialNumber,
      status,
      statusLabel: getReadingStatusLabel(status),
      reasonCode,
      reasonLabel: getReviewReasonLabel(reasonCode),
      canResubmit:
        status === ReadingStatus.REJECTED ||
        status === ReadingStatus.RESUBMISSION_REQUESTED,
      isRead: event.notificationReads.length > 0,
      readAt: event.notificationReads[0]?.readAt ?? null,
    };
  });

  return {
    status: 200,
    body: {
      notifications,
      unreadCount,
      hasMore,
      nextCursor: hasMore ? pageEvents[pageEvents.length - 1]?.id ?? null : null,
    },
  };
}

export async function markClientNotificationsRead(
  userId: string,
  notificationIds?: string[]
) {
  const where: Prisma.ReadingEventWhereInput = {
    ...buildNotificationWhere(userId),
    ...(notificationIds?.length
      ? {
          id: {
            in: notificationIds,
          },
        }
      : {}),
  };

  const events = await prisma.readingEvent.findMany({
    where,
    select: { id: true },
  });

  if (events.length > 0) {
    await prisma.mobileNotificationRead.createMany({
      data: events.map((event) => ({
        userId,
        readingEventId: event.id,
      })),
      skipDuplicates: true,
    });
  }

  const unreadCount = await prisma.readingEvent.count({
    where: {
      ...buildNotificationWhere(userId),
      notificationReads: {
        none: {
          userId,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      message: "notifications_marked_read",
      markedCount: events.length,
      unreadCount,
    },
  };
}
