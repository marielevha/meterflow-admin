import { Prisma, TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type StaffUser = {
  id: string;
  role: UserRole;
};

type TaskFilters = {
  status?: string;
  priority?: string;
  type?: string;
  assignedToId?: string;
  meterId?: string;
  readingId?: string;
};

type UpdateTaskPayload = {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string | null;
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

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function ensureTaskExists(taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, assignedToId: true, status: true },
  });
}

export async function listTasks(filters: TaskFilters) {
  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
  };

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

  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.meterId) where.meterId = filters.meterId;
  if (filters.readingId) where.readingId = filters.readingId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
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
  });

  return { status: 200, body: { tasks } };
}

export async function getTaskDetail(taskId: string) {
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

  return { status: 200, body: { task } };
}

export async function updateTask(staff: StaffUser, taskId: string, payload: UpdateTaskPayload) {
  const existing = await ensureTaskExists(taskId);
  if (!existing) {
    return { status: 404, body: { error: "task_not_found" } };
  }

  const data: Prisma.TaskUpdateInput = {};
  let hasAnyChange = false;

  if (payload.status !== undefined) {
    const parsed = parseTaskStatus(payload.status);
    if (!parsed) return { status: 400, body: { error: "invalid_status" } };
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
    const parsed = parseTaskPriority(payload.priority);
    if (!parsed) return { status: 400, body: { error: "invalid_priority" } };
    data.priority = parsed;
    hasAnyChange = true;
  }

  if (payload.assignedToId !== undefined) {
    if (payload.assignedToId === null || payload.assignedToId === "") {
      data.assignedTo = { disconnect: true };
      hasAnyChange = true;
    } else {
      const assignee = await prisma.user.findFirst({
        where: {
          id: payload.assignedToId,
          role: UserRole.AGENT,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!assignee) {
        return { status: 400, body: { error: "assigned_agent_not_found" } };
      }
      data.assignedTo = { connect: { id: assignee.id } };
      hasAnyChange = true;
    }
  }

  if (!hasAnyChange) {
    return { status: 400, body: { error: "no_updatable_fields" } };
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    select: {
      id: true,
      status: true,
      priority: true,
      assignedToId: true,
      closedAt: true,
      closedById: true,
      updatedAt: true,
    },
  });

  return { status: 200, body: { message: "task_updated", task: updated } };
}

export async function addTaskComment(
  staff: StaffUser,
  taskId: string,
  payload: CreateTaskCommentPayload
) {
  const comment = toNullableTrimmed(payload.comment);
  if (!comment) {
    return { status: 400, body: { error: "comment_required" } };
  }

  const task = await ensureTaskExists(taskId);
  if (!task) {
    return { status: 404, body: { error: "task_not_found" } };
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

  return { status: 201, body: { message: "task_comment_created", comment: created } };
}

export async function addTaskAttachment(
  staff: StaffUser,
  taskId: string,
  payload: CreateTaskAttachmentPayload
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

  return { status: 201, body: { message: "task_attachment_created", attachment: created } };
}
