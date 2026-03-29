import { Prisma, TaskEventType } from "@prisma/client";

import { activeMeterAssignmentCustomerSelect, getActiveMeterCustomer } from "@/lib/meters/assignments";
import { sendPushNotificationToUser } from "@/lib/notifications/expoPush";
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

function buildAgentTaskPushContent(input: {
  type: TaskEventType;
  taskTitle: string;
  customerName: string;
}) {
  switch (input.type) {
    case TaskEventType.ASSIGNED:
      return {
        title: "Nouvelle mission assignee",
        body: `${input.taskTitle} · ${input.customerName}`,
      };
    case TaskEventType.STARTED:
      return {
        title: "Mission demarree",
        body: `La mission ${input.taskTitle} est maintenant en cours.`,
      };
    case TaskEventType.BLOCKED:
      return {
        title: "Mission bloquee",
        body: `La mission ${input.taskTitle} demande un suivi.`,
      };
    case TaskEventType.COMPLETED:
      return {
        title: "Mission terminee",
        body: `La mission ${input.taskTitle} a ete marquee comme terminee.`,
      };
    case TaskEventType.FIELD_RESULT_SUBMITTED:
      return {
        title: "Rapport terrain envoye",
        body: `Le resultat terrain de ${input.taskTitle} a bien ete enregistre.`,
      };
    default:
      return {
        title: "Notification agent",
        body: input.taskTitle,
      };
  }
}

export async function sendPushNotificationForAgentTaskEvent(taskEventId: string) {
  const event = await prisma.taskEvent.findFirst({
    where: {
      id: taskEventId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      actorUserId: true,
      recipientUserId: true,
      task: {
        select: {
          id: true,
          title: true,
          meter: {
            select: {
              ...activeMeterAssignmentCustomerSelect,
            },
          },
        },
      },
    },
  });

  if (!event?.recipientUserId || !event.task) {
    return { sent: false, reason: "task_event_not_found" } as const;
  }

  if (event.actorUserId && event.actorUserId === event.recipientUserId) {
    return { sent: false, reason: "self_notification_skipped" } as const;
  }

  const customer = event.task.meter ? getActiveMeterCustomer(event.task.meter) : null;
  const content = buildAgentTaskPushContent({
    type: event.type,
    taskTitle: event.task.title,
    customerName: customer
      ? personLabel(customer.firstName, customer.lastName, customer.username, customer.phone)
      : "--",
  });

  const result = await sendPushNotificationToUser({
    userId: event.recipientUserId,
    title: content.title,
    body: content.body,
    data: {
      taskId: event.task.id,
      notificationId: event.id,
      notificationType: event.type,
    },
  });

  return result.sent
    ? ({ sent: true, reason: null } as const)
    : ({ sent: false, reason: result.reason ?? "push_not_sent" } as const);
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
                ...activeMeterAssignmentCustomerSelect,
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
    const customer = event.task.meter ? getActiveMeterCustomer(event.task.meter) : null;
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
      customerName: customer
        ? personLabel(
            customer.firstName,
            customer.lastName,
            customer.username,
            customer.phone
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
