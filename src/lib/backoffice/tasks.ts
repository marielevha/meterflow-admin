import {
  Prisma,
  ReadingEventType,
  TaskItemStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTaskTransitionAllowed } from "@/lib/workflows/stateMachines";

type StaffUser = {
  id: string;
  role: UserRole;
};

type TaskFilters = {
  q?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignedToId?: string;
  meterId?: string;
  readingId?: string;
  page?: number;
  pageSize?: number;
};

type CreateTaskPayload = {
  title?: string;
  description?: string;
  type?: TaskType | string;
  status?: TaskStatus | string;
  priority?: TaskPriority | string;
  assignedToId?: string | null;
  meterId?: string | null;
  readingId?: string | null;
  dueAt?: string | Date | null;
};

type UpdateTaskPayload = {
  title?: string;
  description?: string;
  type?: TaskType | string;
  status?: TaskStatus | string;
  priority?: TaskPriority | string;
  assignedToId?: string | null;
  dueAt?: string | Date | null;
};

type CreateTaskCommentPayload = {
  comment?: string;
  isInternal?: boolean;
};

type CreateTaskAttachmentPayload = {
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileHash?: string;
  fileSizeBytes?: number;
};

type CreateTaskItemPayload = {
  title?: string;
  details?: string;
  sortOrder?: number;
};

type UpdateTaskItemPayload = {
  title?: string;
  details?: string;
  sortOrder?: number;
  status?: TaskItemStatus | string;
};

function isManager(role: UserRole) {
  return role === UserRole.SUPERVISOR || role === UserRole.ADMIN;
}

function parseTaskStatus(value: unknown): TaskStatus | null {
  return Object.values(TaskStatus).includes(value as TaskStatus) ? (value as TaskStatus) : null;
}

function parseTaskPriority(value: unknown): TaskPriority | null {
  return Object.values(TaskPriority).includes(value as TaskPriority)
    ? (value as TaskPriority)
    : null;
}

function parseTaskType(value: unknown): TaskType | null {
  return Object.values(TaskType).includes(value as TaskType) ? (value as TaskType) : null;
}

function parseTaskItemStatus(value: unknown): TaskItemStatus | null {
  return Object.values(TaskItemStatus).includes(value as TaskItemStatus)
    ? (value as TaskItemStatus)
    : null;
}

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureTaskExists(taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      assignedToId: true,
      status: true,
      readingId: true,
      meterId: true,
      title: true,
    },
  });
}

async function ensureAssigneeIfProvided(assignedToId: string | null | undefined) {
  if (!assignedToId) return null;
  const assignee = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true },
  });
  return assignee;
}

function canAccessTask(staff: StaffUser, task: { assignedToId: string | null }) {
  return isManager(staff.role) || task.assignedToId === staff.id;
}

async function createReadingEvent(task: { readingId: string | null }, userId: string, payload: Prisma.JsonObject) {
  if (!task.readingId) return;
  await prisma.readingEvent.create({
    data: {
      readingId: task.readingId,
      userId,
      type: ReadingEventType.TASK_UPDATED,
      payload,
    },
  });
}

export async function getTasksStats(staff: StaffUser) {
  const scopedWhere: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(staff.role === UserRole.AGENT ? { assignedToId: staff.id } : {}),
  };

  const [total, open, inProgress, blocked, done, canceled, overdue] = await prisma.$transaction([
    prisma.task.count({ where: scopedWhere }),
    prisma.task.count({ where: { ...scopedWhere, status: TaskStatus.OPEN } }),
    prisma.task.count({ where: { ...scopedWhere, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { ...scopedWhere, status: TaskStatus.BLOCKED } }),
    prisma.task.count({ where: { ...scopedWhere, status: TaskStatus.DONE } }),
    prisma.task.count({ where: { ...scopedWhere, status: TaskStatus.CANCELED } }),
    prisma.task.count({
      where: {
        ...scopedWhere,
        dueAt: { lt: new Date() },
        status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      stats: { total, open, inProgress, blocked, done, canceled, overdue },
    },
  };
}

export async function listTasks(staff: StaffUser, filters: TaskFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(filters.pageSize || 10)));

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(staff.role === UserRole.AGENT ? { assignedToId: staff.id } : {}),
  };

  const q = toNullableTrimmed(filters.q);
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { meter: { serialNumber: { contains: q, mode: "insensitive" } } },
      { meter: { meterReference: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.status) {
    const status = parseTaskStatus(filters.status);
    if (!status) return { status: 400, body: { error: "invalid_status_filter" } };
    where.status = status;
  }

  if (filters.priority) {
    const priority = parseTaskPriority(filters.priority);
    if (!priority) return { status: 400, body: { error: "invalid_priority_filter" } };
    where.priority = priority;
  }

  if (filters.type) {
    const type = parseTaskType(filters.type);
    if (!type) return { status: 400, body: { error: "invalid_type_filter" } };
    where.type = type;
  }

  if (filters.assignedToId) {
    if (staff.role === UserRole.AGENT && filters.assignedToId !== staff.id) {
      return { status: 403, body: { error: "insufficient_scope" } };
    }
    where.assignedToId = filters.assignedToId;
  }

  if (filters.meterId) where.meterId = filters.meterId;
  if (filters.readingId) where.readingId = filters.readingId;

  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        meterId: true,
        readingId: true,
        assignedToId: true,
        createdById: true,
        closedById: true,
        type: true,
        status: true,
        priority: true,
        title: true,
        description: true,
        dueAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        meter: {
          select: {
            id: true,
            serialNumber: true,
            meterReference: true,
            city: true,
            zone: true,
          },
        },
        reading: {
          select: {
            id: true,
            status: true,
            readingAt: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      tasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  };
}

export async function createTask(staff: StaffUser, payload: CreateTaskPayload) {
  if (!isManager(staff.role)) {
    return { status: 403, body: { error: "insufficient_role" } };
  }

  const title = toNullableTrimmed(payload.title);
  const description = toNullableTrimmed(payload.description);
  const meterId = toNullableTrimmed(payload.meterId);
  const readingId = toNullableTrimmed(payload.readingId);
  const dueAt = toNullableDate(payload.dueAt);

  if (!title) return { status: 400, body: { error: "title_required" } };
  if (!meterId && !readingId) {
    return { status: 400, body: { error: "meter_or_reading_required" } };
  }

  const type = payload.type ? parseTaskType(payload.type) : TaskType.GENERAL;
  if (!type) return { status: 400, body: { error: "invalid_type" } };

  const priority = payload.priority ? parseTaskPriority(payload.priority) : TaskPriority.MEDIUM;
  if (!priority) return { status: 400, body: { error: "invalid_priority" } };

  const status = payload.status ? parseTaskStatus(payload.status) : TaskStatus.OPEN;
  if (!status) return { status: 400, body: { error: "invalid_status" } };

  const assigneeId = payload.assignedToId === "" ? null : payload.assignedToId ?? null;
  const assignee = await ensureAssigneeIfProvided(assigneeId);
  if (assigneeId && !assignee) return { status: 400, body: { error: "assigned_agent_not_found" } };

  const meter = meterId
    ? await prisma.meter.findFirst({ where: { id: meterId, deletedAt: null }, select: { id: true } })
    : null;
  if (meterId && !meter) return { status: 404, body: { error: "meter_not_found" } };

  const reading = readingId
    ? await prisma.reading.findFirst({
        where: { id: readingId, deletedAt: null },
        select: { id: true, meterId: true },
      })
    : null;
  if (readingId && !reading) return { status: 404, body: { error: "reading_not_found" } };

  const resolvedMeterId = meterId || reading?.meterId || null;
  if (!resolvedMeterId) return { status: 400, body: { error: "meter_resolution_failed" } };
  if (meterId && reading?.meterId && reading.meterId !== meterId) {
    return { status: 400, body: { error: "meter_reading_mismatch" } };
  }

  const created = await prisma.task.create({
    data: {
      title,
      description,
      type,
      status,
      priority,
      meterId: resolvedMeterId,
      readingId: reading?.id || null,
      dueAt,
      assignedToId: assignee?.id || null,
      createdById: staff.id,
      ...(status === TaskStatus.DONE || status === TaskStatus.CANCELED
        ? { closedAt: new Date(), closedById: staff.id }
        : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      meterId: true,
      readingId: true,
      dueAt: true,
      createdAt: true,
    },
  });

  await createReadingEvent(
    { readingId: created.readingId },
    staff.id,
    {
      action: "task_created_manual",
      taskId: created.id,
      title: created.title,
      type: created.type,
      priority: created.priority,
      status: created.status,
    },
  );

  return { status: 201, body: { message: "task_created", task: created } };
}

function buildTaskTimeline(task: {
  createdAt: Date;
  updatedAt: Date;
  comments: Array<{
    id: string;
    createdAt: Date;
    comment: string;
    user: { firstName: string | null; lastName: string | null; username: string | null; role: UserRole };
  }>;
  attachments: Array<{
    id: string;
    createdAt: Date;
    fileName: string;
    uploadedBy: { firstName: string | null; lastName: string | null; username: string | null; role: UserRole };
  }>;
  items: Array<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    status: TaskItemStatus;
  }>;
}) {
  const timeline: Array<{ id: string; at: Date; type: string; label: string }> = [];
  timeline.push({ id: "task-created", at: task.createdAt, type: "TASK", label: "Task created" });

  if (task.updatedAt.getTime() !== task.createdAt.getTime()) {
    timeline.push({ id: "task-updated", at: task.updatedAt, type: "TASK", label: "Task updated" });
  }

  for (const comment of task.comments) {
    const author = [comment.user.firstName, comment.user.lastName].filter(Boolean).join(" ").trim() || comment.user.username || "User";
    timeline.push({
      id: `comment-${comment.id}`,
      at: comment.createdAt,
      type: "COMMENT",
      label: `${author}: ${comment.comment}`,
    });
  }

  for (const attachment of task.attachments) {
    const author =
      [attachment.uploadedBy.firstName, attachment.uploadedBy.lastName].filter(Boolean).join(" ").trim() ||
      attachment.uploadedBy.username ||
      "User";
    timeline.push({
      id: `attachment-${attachment.id}`,
      at: attachment.createdAt,
      type: "ATTACHMENT",
      label: `${author} attached ${attachment.fileName}`,
    });
  }

  for (const item of task.items) {
    timeline.push({
      id: `item-${item.id}`,
      at: item.updatedAt,
      type: "CHECKLIST",
      label: `Checklist item '${item.title}' -> ${item.status}`,
    });
  }

  return timeline.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function getTaskDetail(staff: StaffUser, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      meterId: true,
      readingId: true,
      assignedToId: true,
      createdById: true,
      closedById: true,
      type: true,
      status: true,
      priority: true,
      title: true,
      description: true,
      dueAt: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          city: true,
          zone: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      },
      reading: {
        select: {
          id: true,
          status: true,
          readingAt: true,
          primaryIndex: true,
          secondaryIndex: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
          phone: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
        },
      },
      closedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
        },
      },
      items: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          details: true,
          status: true,
          sortOrder: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          completedBy: {
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
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          comment: true,
          isInternal: true,
          createdAt: true,
          updatedAt: true,
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
      attachments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          fileHash: true,
          fileSizeBytes: true,
          createdAt: true,
          uploadedBy: {
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

  if (!task) {
    return { status: 404, body: { error: "task_not_found" } };
  }

  if (!canAccessTask(staff, task)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const timeline = buildTaskTimeline(task);
  return { status: 200, body: { task: { ...task, timeline } } };
}

export async function updateTask(staff: StaffUser, taskId: string, payload: UpdateTaskPayload) {
  const existing = await ensureTaskExists(taskId);
  if (!existing) {
    return { status: 404, body: { error: "task_not_found" } };
  }

  if (!canAccessTask(staff, existing)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const manager = isManager(staff.role);
  const data: Prisma.TaskUpdateInput = {};
  let hasAnyChange = false;

  if (payload.status !== undefined) {
    const parsed = parseTaskStatus(payload.status);
    if (!parsed) return { status: 400, body: { error: "invalid_status" } };
    if (!isTaskTransitionAllowed(staff.role, existing.status, parsed)) {
      return { status: 409, body: { error: "invalid_status_transition" } };
    }

    data.status = parsed;
    hasAnyChange = true;

    if (parsed === TaskStatus.DONE || parsed === TaskStatus.CANCELED) {
      data.closedAt = new Date();
      data.closedBy = { connect: { id: staff.id } };
    } else {
      data.closedAt = null;
      data.closedBy = { disconnect: true };
    }
  }

  if (payload.priority !== undefined) {
    if (!manager) return { status: 403, body: { error: "priority_update_forbidden" } };
    const parsed = parseTaskPriority(payload.priority);
    if (!parsed) return { status: 400, body: { error: "invalid_priority" } };
    data.priority = parsed;
    hasAnyChange = true;
  }

  if (payload.type !== undefined) {
    if (!manager) return { status: 403, body: { error: "type_update_forbidden" } };
    const parsed = parseTaskType(payload.type);
    if (!parsed) return { status: 400, body: { error: "invalid_type" } };
    data.type = parsed;
    hasAnyChange = true;
  }

  if (payload.title !== undefined) {
    if (!manager) return { status: 403, body: { error: "title_update_forbidden" } };
    const title = toNullableTrimmed(payload.title);
    if (!title) return { status: 400, body: { error: "title_required" } };
    data.title = title;
    hasAnyChange = true;
  }

  if (payload.description !== undefined) {
    if (!manager) return { status: 403, body: { error: "description_update_forbidden" } };
    data.description = toNullableTrimmed(payload.description);
    hasAnyChange = true;
  }

  if (payload.assignedToId !== undefined) {
    if (!manager) return { status: 403, body: { error: "assignment_update_forbidden" } };

    if (payload.assignedToId === null || payload.assignedToId === "") {
      data.assignedTo = { disconnect: true };
      hasAnyChange = true;
    } else {
      const assignee = await ensureAssigneeIfProvided(payload.assignedToId);
      if (!assignee) {
        return { status: 400, body: { error: "assigned_agent_not_found" } };
      }
      data.assignedTo = { connect: { id: assignee.id } };
      hasAnyChange = true;
    }
  }

  if (payload.dueAt !== undefined) {
    if (!manager) return { status: 403, body: { error: "due_date_update_forbidden" } };
    const dueAt = toNullableDate(payload.dueAt);
    if (payload.dueAt && !dueAt) return { status: 400, body: { error: "invalid_due_at" } };
    data.dueAt = dueAt;
    hasAnyChange = true;
  }

  if (!hasAnyChange) {
    return { status: 400, body: { error: "no_updatable_fields" } };
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      assignedToId: true,
      dueAt: true,
      closedAt: true,
      closedById: true,
      updatedAt: true,
      readingId: true,
    },
  });

  await createReadingEvent(
    { readingId: updated.readingId },
    staff.id,
    {
      action: "task_updated",
      taskId: updated.id,
      status: updated.status,
      priority: updated.priority,
      type: updated.type,
      assignedToId: updated.assignedToId,
      dueAt: updated.dueAt?.toISOString() || null,
    },
  );

  return { status: 200, body: { message: "task_updated", task: updated } };
}

export async function addTaskComment(
  staff: StaffUser,
  taskId: string,
  payload: CreateTaskCommentPayload,
) {
  const comment = toNullableTrimmed(payload.comment);
  if (!comment) {
    return { status: 400, body: { error: "comment_required" } };
  }

  const task = await ensureTaskExists(taskId);
  if (!task) {
    return { status: 404, body: { error: "task_not_found" } };
  }
  if (!canAccessTask(staff, task)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const created = await prisma.taskComment.create({
    data: {
      taskId,
      userId: staff.id,
      comment,
      isInternal: typeof payload.isInternal === "boolean" ? payload.isInternal : true,
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      comment: true,
      isInternal: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await createReadingEvent(task, staff.id, {
    action: "task_comment_added",
    taskId,
    commentId: created.id,
  });

  return { status: 201, body: { message: "task_comment_created", comment: created } };
}

export async function addTaskAttachment(
  staff: StaffUser,
  taskId: string,
  payload: CreateTaskAttachmentPayload,
) {
  const fileUrl = toNullableTrimmed(payload.fileUrl);
  const fileName = toNullableTrimmed(payload.fileName);
  const mimeType = toNullableTrimmed(payload.mimeType);
  const fileHash = toNullableTrimmed(payload.fileHash);
  const fileSizeBytes =
    typeof payload.fileSizeBytes === "number" && Number.isFinite(payload.fileSizeBytes)
      ? Math.max(0, Math.floor(payload.fileSizeBytes))
      : null;

  if (!fileUrl || !fileName) {
    return { status: 400, body: { error: "file_url_and_file_name_required" } };
  }

  const task = await ensureTaskExists(taskId);
  if (!task) {
    return { status: 404, body: { error: "task_not_found" } };
  }
  if (!canAccessTask(staff, task)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const created = await prisma.taskAttachment.create({
    data: {
      taskId,
      uploadedById: staff.id,
      fileUrl,
      fileName,
      mimeType,
      fileHash,
      fileSizeBytes,
    },
    select: {
      id: true,
      taskId: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileHash: true,
      fileSizeBytes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await createReadingEvent(task, staff.id, {
    action: "task_attachment_added",
    taskId,
    attachmentId: created.id,
  });

  return { status: 201, body: { message: "task_attachment_created", attachment: created } };
}

export async function addTaskItem(staff: StaffUser, taskId: string, payload: CreateTaskItemPayload) {
  const task = await ensureTaskExists(taskId);
  if (!task) return { status: 404, body: { error: "task_not_found" } };
  if (!canAccessTask(staff, task)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const title = toNullableTrimmed(payload.title);
  const details = toNullableTrimmed(payload.details);
  const sortOrder =
    typeof payload.sortOrder === "number" && Number.isFinite(payload.sortOrder)
      ? Math.max(0, Math.floor(payload.sortOrder))
      : 0;

  if (!title) return { status: 400, body: { error: "title_required" } };

  const item = await prisma.taskItem.create({
    data: {
      taskId,
      title,
      details,
      sortOrder,
      meterId: task.meterId,
      readingId: task.readingId,
    },
    select: {
      id: true,
      taskId: true,
      title: true,
      details: true,
      status: true,
      sortOrder: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await createReadingEvent(task, staff.id, {
    action: "task_item_added",
    taskId,
    itemId: item.id,
    title: item.title,
  });

  return { status: 201, body: { message: "task_item_created", item } };
}

export async function updateTaskItem(
  staff: StaffUser,
  taskId: string,
  itemId: string,
  payload: UpdateTaskItemPayload,
) {
  const task = await ensureTaskExists(taskId);
  if (!task) return { status: 404, body: { error: "task_not_found" } };
  if (!canAccessTask(staff, task)) {
    return { status: 403, body: { error: "insufficient_scope" } };
  }

  const existingItem = await prisma.taskItem.findFirst({
    where: {
      id: itemId,
      taskId,
      deletedAt: null,
    },
    select: { id: true, status: true },
  });

  if (!existingItem) {
    return { status: 404, body: { error: "task_item_not_found" } };
  }

  const data: Prisma.TaskItemUpdateInput = {};
  let changed = false;

  if (payload.title !== undefined) {
    const title = toNullableTrimmed(payload.title);
    if (!title) return { status: 400, body: { error: "title_required" } };
    data.title = title;
    changed = true;
  }

  if (payload.details !== undefined) {
    data.details = toNullableTrimmed(payload.details);
    changed = true;
  }

  if (payload.sortOrder !== undefined) {
    if (typeof payload.sortOrder !== "number" || !Number.isFinite(payload.sortOrder)) {
      return { status: 400, body: { error: "invalid_sort_order" } };
    }
    data.sortOrder = Math.max(0, Math.floor(payload.sortOrder));
    changed = true;
  }

  if (payload.status !== undefined) {
    const nextStatus = parseTaskItemStatus(payload.status);
    if (!nextStatus) return { status: 400, body: { error: "invalid_item_status" } };

    data.status = nextStatus;
    data.completedAt = nextStatus === TaskItemStatus.DONE ? new Date() : null;
    data.completedBy = nextStatus === TaskItemStatus.DONE ? { connect: { id: staff.id } } : { disconnect: true };
    changed = true;
  }

  if (!changed) {
    return { status: 400, body: { error: "no_updatable_fields" } };
  }

  const item = await prisma.taskItem.update({
    where: { id: itemId },
    data,
    select: {
      id: true,
      taskId: true,
      title: true,
      details: true,
      status: true,
      sortOrder: true,
      completedAt: true,
      updatedAt: true,
      completedById: true,
    },
  });

  await createReadingEvent(task, staff.id, {
    action: "task_item_updated",
    taskId,
    itemId,
    status: item.status,
  });

  return { status: 200, body: { message: "task_item_updated", item } };
}
