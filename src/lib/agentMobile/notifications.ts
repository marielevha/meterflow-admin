import { Prisma, TaskEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type NotificationListOptions = {
  limit?: number;
  cursor?: string;
};

type TaskEventPayload = {
  comment?: unknown;
  resolutionCode?: unknown;
  nextStatus?: unknown;
  previousStatus?: unknown;
  source?: unknown;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function personLabel(
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null,
  phone?: string | null
) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || username || phone || "--";
}

function buildAgentNotificationWhere(userId: string): Prisma.TaskEventWhereInput {
  return {
    deletedAt: null,
    recipientUserId: userId,
  };
}

export async function createAgentTaskEvent(
  db: DbClient,
  input: {
    taskId: string;
    type: TaskEventType;
    recipientUserId?: string | null;
    actorUserId?: string | null;
    payload?: Prisma.InputJsonValue;
  }
) {
  if (!input.recipientUserId) {
    return null;
  }

  return db.taskEvent.create({
    data: {
      taskId: input.taskId,
      type: input.type,
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId ?? null,
      payload: input.payload ?? {},
    },
    select: {
      id: true,
    },
  });
}

export async function listAgentNotifications(
  userId: string,
  options?: NotificationListOptions
) {
  const where = buildAgentNotificationWhere(userId);
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const queryCursor = toOptionalString(options?.cursor);

  const [events, unreadCount] = await Promise.all([
    prisma.taskEvent.findMany({
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
        actorUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueAt: true,
            meter: {
              select: {
                serialNumber: true,
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    username: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.taskEvent.count({
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
    const payload = ((event.payload ?? {}) as TaskEventPayload) || {};
    return {
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      taskId: event.task.id,
      taskTitle: event.task.title,
      taskStatus: event.task.status,
      taskPriority: event.task.priority,
      taskDueAt: event.task.dueAt?.toISOString() ?? null,
      meterSerialNumber: event.task.meter?.serialNumber ?? "--",
      customerName: event.task.meter?.customer
        ? personLabel(
            event.task.meter.customer.firstName,
            event.task.meter.customer.lastName,
            event.task.meter.customer.username,
            event.task.meter.customer.phone
          )
        : "--",
      actorName: event.actorUser
        ? personLabel(
            event.actorUser.firstName,
            event.actorUser.lastName,
            event.actorUser.username,
            event.actorUser.phone
          )
        : null,
      comment: toOptionalString(payload.comment),
      resolutionCode: toOptionalString(payload.resolutionCode),
      nextStatus: toOptionalString(payload.nextStatus) ?? event.task.status,
      previousStatus: toOptionalString(payload.previousStatus),
      source: toOptionalString(payload.source),
      isRead: event.notificationReads.length > 0,
      readAt: event.notificationReads[0]?.readAt?.toISOString() ?? null,
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

export async function markAgentNotificationsRead(
  userId: string,
  notificationIds?: string[]
) {
  const where: Prisma.TaskEventWhereInput = {
    ...buildAgentNotificationWhere(userId),
    ...(notificationIds?.length
      ? {
          id: {
            in: notificationIds,
          },
        }
      : {}),
  };

  const events = await prisma.taskEvent.findMany({
    where,
    select: { id: true },
  });

  if (events.length > 0) {
    await prisma.agentNotificationRead.createMany({
      data: events.map((event) => ({
        userId,
        taskEventId: event.id,
      })),
      skipDuplicates: true,
    });
  }

  const unreadCount = await prisma.taskEvent.count({
    where: {
      ...buildAgentNotificationWhere(userId),
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
