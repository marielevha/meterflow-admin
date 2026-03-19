import { ReadingEventType, ReadingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getClientReadingDecisionMessage,
  getClientReadingDecisionTitle,
  getReviewReasonLabel,
} from "@/lib/readings/reviewReasons";

type NotificationPayload = {
  clientTitle?: unknown;
  clientMessage?: unknown;
  reason?: unknown;
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

export async function listClientNotifications(userId: string) {
  const events = await prisma.readingEvent.findMany({
    where: {
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
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      createdAt: true,
      payload: true,
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
  });

  const notifications = events.map((event) => {
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
      reasonCode,
      reasonLabel: getReviewReasonLabel(reasonCode),
    };
  });

  return { status: 200, body: { notifications } };
}
