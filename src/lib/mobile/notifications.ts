import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getReadingStatusLabel, getReviewReasonLabel } from "@/lib/readings/reviewReasons";

type NotificationListOptions = {
  limit?: number;
  cursor?: string;
};

type NotificationMetadata = {
  category?: unknown;
  readingId?: unknown;
  invoiceId?: unknown;
  invoiceNumber?: unknown;
  meterId?: unknown;
  meterSerialNumber?: unknown;
  status?: unknown;
  statusLabel?: unknown;
  reasonCode?: unknown;
  reasonLabel?: unknown;
  channel?: unknown;
  paymentMethod?: unknown;
  assignmentSource?: unknown;
};

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function inferCategory(type: string, metadata: NotificationMetadata) {
  const explicit = toOptionalString(metadata.category);
  if (explicit) return explicit;
  if (type.startsWith("READING_")) return "READING";
  if (type.startsWith("INVOICE_")) return "BILLING";
  if (type.startsWith("METER_")) return "METER";
  if (type.endsWith("_REMINDER") || type === "READING_REMINDER") return "REMINDER";
  return "GENERAL";
}

function deriveStatusLabel(type: string, metadata: NotificationMetadata) {
  const explicit = toOptionalString(metadata.statusLabel);
  if (explicit) return explicit;

  const status = toOptionalString(metadata.status);
  if (status) {
    const readingLabel = getReadingStatusLabel(status);
    if (readingLabel) return readingLabel;

    switch (status) {
      case "ISSUED":
        return "Émise";
      case "DELIVERED":
        return "Diffusée";
      case "PARTIALLY_PAID":
        return "Partiellement payée";
      case "PAID":
        return "Payée";
      case "CANCELED":
        return "Annulée";
      default:
        return status;
    }
  }

  switch (type) {
    case "INVOICE_ISSUED":
      return "Émise";
    case "INVOICE_DELIVERED":
      return "Diffusée";
    case "INVOICE_PAYMENT_REGISTERED":
      return "Paiement enregistré";
    case "INVOICE_PAID":
      return "Payée";
    case "INVOICE_CANCELED":
      return "Annulée";
    case "METER_ASSIGNED":
      return "Compteur lié";
    case "METER_UNASSIGNED":
      return "Compteur retiré";
    case "READING_REMINDER":
      return "Rappel";
    default:
      return null;
  }
}

function deriveReasonLabel(metadata: NotificationMetadata) {
  return toOptionalString(metadata.reasonLabel) || getReviewReasonLabel(toOptionalString(metadata.reasonCode));
}

export async function listClientNotifications(
  userId: string,
  options?: NotificationListOptions
) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const queryCursor = toOptionalString(options?.cursor);

  const [rows, unreadCount] = await Promise.all([
    prisma.customerNotification.findMany({
      where: {
        userId,
        deletedAt: null,
      },
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
        title: true,
        body: true,
        actionPath: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.customerNotification.count({
      where: {
        userId,
        deletedAt: null,
        readAt: null,
      },
    }),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const notifications = pageRows.map((row) => {
    const metadata = ((row.metadata ?? {}) as NotificationMetadata) || {};
    const category = inferCategory(row.type, metadata);
    const reasonCode = toOptionalString(metadata.reasonCode);

    return {
      id: row.id,
      type: row.type,
      category,
      createdAt: row.createdAt,
      title: row.title,
      body: row.body,
      actionPath: row.actionPath,
      readingId: toOptionalString(metadata.readingId),
      invoiceId: toOptionalString(metadata.invoiceId),
      invoiceNumber: toOptionalString(metadata.invoiceNumber),
      meterId: toOptionalString(metadata.meterId),
      meterSerialNumber: toOptionalString(metadata.meterSerialNumber),
      status: toOptionalString(metadata.status),
      statusLabel: deriveStatusLabel(row.type, metadata),
      reasonCode,
      reasonLabel: deriveReasonLabel(metadata),
      channel: toOptionalString(metadata.channel),
      paymentMethod: toOptionalString(metadata.paymentMethod),
      assignmentSource: toOptionalString(metadata.assignmentSource),
      isRead: !!row.readAt,
      readAt: row.readAt,
    };
  });

  return {
    status: 200,
    body: {
      notifications,
      unreadCount,
      hasMore,
      nextCursor: hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null,
    },
  };
}

export async function markClientNotificationsRead(
  userId: string,
  notificationIds?: string[]
) {
  const where: Prisma.CustomerNotificationWhereInput = {
    userId,
    deletedAt: null,
    readAt: null,
    ...(notificationIds?.length
      ? {
          id: {
            in: notificationIds,
          },
        }
      : {}),
  };

  const updated = await prisma.customerNotification.updateMany({
    where,
    data: {
      readAt: new Date(),
    },
  });

  const unreadCount = await prisma.customerNotification.count({
    where: {
      userId,
      deletedAt: null,
      readAt: null,
    },
  });

  return {
    status: 200,
    body: {
      message: "notifications_marked_read",
      markedCount: updated.count,
      unreadCount,
    },
  };
}
