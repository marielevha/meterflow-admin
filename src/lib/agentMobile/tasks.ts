import {
  MeterType,
  Prisma,
  ReadingEventType,
  ReadingSource,
  ReadingStatus,
  TaskEventType,
  TaskPriority,
  TaskResolutionCode,
  TaskStatus,
  TaskType,
  UserRole,
} from '@prisma/client';

import { createAgentTaskEvent } from '@/lib/agentMobile/notifications';
import { sendPushNotificationForAgentTaskEvent } from '@/lib/agentMobile/notifications';
import { getTaskDetail } from '@/lib/backoffice/tasks';
import {
  activeMeterAssignmentCustomerSelect,
  getActiveMeterCustomer,
  type MeterWithActiveAssignment,
} from '@/lib/meters/assignments';
import { prisma } from '@/lib/prisma';
import { isTaskTransitionAllowed } from '@/lib/workflows/stateMachines';

type AgentStaff = {
  id: string;
  role: UserRole;
};

type StartableTask = {
  id: string;
  status: TaskStatus;
  startedAt: Date | null;
  startedById: string | null;
  assignedToId: string | null;
  readingId: string | null;
};

type ListedAgentTask = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  resolutionCode: TaskResolutionCode | null;
  title: string;
  description: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  fieldSubmittedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  meter: {
    id: string;
    type: MeterType;
    serialNumber: string;
    meterReference: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    zone: string | null;
    assignments?: MeterWithActiveAssignment['assignments'];
  } | null;
  reading: {
    id: string;
    status: ReadingStatus;
    readingAt: Date | null;
  } | null;
};

type SubmitAgentTaskResultPayload = {
  resolutionCode?: string;
  comment?: string;
  readingAt?: string;
  primaryIndex?: string | number;
  secondaryIndex?: string | number | null;
  imageUrl?: string;
  imageHash?: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
  gpsLatitude?: string | number;
  gpsLongitude?: string | number;
  gpsAccuracyMeters?: string | number;
};

export type AgentMissionFilter = 'ALL' | 'TODAY' | 'OVERDUE' | 'IN_PROGRESS' | 'DONE';

const ACTIVE_TASK_STATUSES = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] as const;
const FINAL_TASK_STATUSES = [TaskStatus.DONE, TaskStatus.CANCELED] as const;

function isActiveTaskStatus(status: TaskStatus) {
  return ACTIVE_TASK_STATUSES.includes(status as (typeof ACTIVE_TASK_STATUSES)[number]);
}

function isFinalTaskStatus(status: TaskStatus) {
  return FINAL_TASK_STATUSES.includes(status as (typeof FINAL_TASK_STATUSES)[number]);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function parseMissionFilter(value?: string | null): AgentMissionFilter {
  switch (value) {
    case 'TODAY':
    case 'OVERDUE':
    case 'IN_PROGRESS':
    case 'DONE':
      return value;
    default:
      return 'ALL';
  }
}

function parseResolutionCode(value: unknown): TaskResolutionCode | null {
  if (!value || typeof value !== 'string') return null;
  return Object.values(TaskResolutionCode).includes(value as TaskResolutionCode)
    ? (value as TaskResolutionCode)
    : null;
}

function buildScopeWhere(agentId: string, filter: AgentMissionFilter): Prisma.TaskWhereInput {
  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const base: Prisma.TaskWhereInput = {
    assignedToId: agentId,
    deletedAt: null,
  };

  switch (filter) {
    case 'TODAY':
      return {
        ...base,
        dueAt: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: {
          in: [...ACTIVE_TASK_STATUSES],
        },
      };
    case 'OVERDUE':
      return {
        ...base,
        dueAt: { lt: now },
        status: {
          in: [...ACTIVE_TASK_STATUSES],
        },
      };
    case 'IN_PROGRESS':
      return {
        ...base,
        status: TaskStatus.IN_PROGRESS,
      };
    case 'DONE':
      return {
        ...base,
        status: TaskStatus.DONE,
      };
    default:
      return base;
  }
}

function normalizePage(rawValue?: string | null, fallback = 1) {
  const value = Number(rawValue ?? fallback);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
}

function normalizePageSize(rawValue?: string | null, fallback = 20) {
  const value = Number(rawValue ?? fallback);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(50, Math.max(5, Math.trunc(value)));
}

function formatPerson(
  firstName: string | null,
  lastName: string | null,
  username?: string | null,
  phone?: string | null
) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || username || phone || '--';
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDecimalInput(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

function normalizeImageSize(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function parseReadingDate(value: unknown) {
  if (!value || typeof value !== 'string') return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatAddressLabel(meter: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  zone?: string | null;
}) {
  return [meter.addressLine1, meter.addressLine2, meter.city, meter.zone].filter(Boolean).join(' / ') || '--';
}

function mapResolutionToStatus(code: TaskResolutionCode) {
  return code === TaskResolutionCode.ESCALATION_REQUIRED ? TaskStatus.BLOCKED : TaskStatus.DONE;
}

function shouldCreateReading(code: TaskResolutionCode) {
  return code === TaskResolutionCode.READING_CONFIRMED;
}

function buildMissionResultComment(code: TaskResolutionCode, comment: string | null) {
  const base = `Field result submitted: ${code}`;
  return comment ? `${base}\n${comment}` : base;
}

function buildQuickTransitionComment(nextStatus: TaskStatus) {
  switch (nextStatus) {
    case TaskStatus.IN_PROGRESS:
      return 'Mission started from agent mobile quick action.';
    case TaskStatus.BLOCKED:
      return 'Mission blocked from agent mobile quick action.';
    case TaskStatus.DONE:
      return 'Mission marked as completed from agent mobile quick action.';
    default:
      return `Mission moved to ${nextStatus} from agent mobile quick action.`;
  }
}

function eventTypeForStatus(status: TaskStatus) {
  switch (status) {
    case TaskStatus.BLOCKED:
      return TaskEventType.BLOCKED;
    case TaskStatus.DONE:
      return TaskEventType.COMPLETED;
    default:
      return TaskEventType.STARTED;
  }
}

function mapTask(task: ListedAgentTask) {
  const customer = task.meter ? getActiveMeterCustomer(task.meter) : null;
  const customerName = customer
    ? formatPerson(customer.firstName, customer.lastName, undefined, customer.phone)
    : '--';
  const now = new Date();
  const dueAt = task.dueAt ?? null;
  const isOverdue = Boolean(dueAt && dueAt.getTime() < now.getTime() && isActiveTaskStatus(task.status));
  const todayStart = startOfToday().getTime();
  const todayEnd = endOfToday().getTime();
  const isToday = Boolean(
    dueAt && dueAt.getTime() >= todayStart && dueAt.getTime() < todayEnd && isActiveTaskStatus(task.status)
  );

  return {
    id: task.id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    title: task.title,
    description: task.description,
    dueAt: task.dueAt,
    startedAt: task.startedAt,
    fieldSubmittedAt: task.fieldSubmittedAt,
    closedAt: task.closedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    resolutionCode: task.resolutionCode,
    isToday,
    isOverdue,
    hasFieldReport: Boolean(task.fieldSubmittedAt),
    customer: {
      id: customer?.id ?? null,
      name: customerName,
      phone: customer?.phone ?? null,
    },
    meter: {
      id: task.meter?.id ?? null,
      type: task.meter?.type ?? null,
      serialNumber: task.meter?.serialNumber ?? '--',
      meterReference: task.meter?.meterReference ?? null,
      city: task.meter?.city ?? null,
      zone: task.meter?.zone ?? null,
      addressLabel: task.meter
        ? formatAddressLabel(task.meter)
        : '--',
    },
    reading: task.reading
      ? {
          id: task.reading.id,
          status: task.reading.status,
          readingAt: task.reading.readingAt,
        }
      : null,
  };
}

async function getAccessibleAgentTask(staff: AgentStaff, taskId: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      assignedToId: staff.id,
      deletedAt: null,
    },
    select: {
      id: true,
      meterId: true,
      readingId: true,
      assignedToId: true,
      status: true,
      title: true,
      startedAt: true,
      startedById: true,
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

async function createAgentConfirmedReading(
  tx: Prisma.TransactionClient,
  staff: AgentStaff,
  task: NonNullable<Awaited<ReturnType<typeof getAccessibleAgentTask>>>,
  payload: {
    readingAt: Date;
    primaryIndex: Prisma.Decimal;
    secondaryIndex: Prisma.Decimal | null;
    imageUrl: string;
    imageHash: string | null;
    imageMimeType: string | null;
    imageSizeBytes: number | null;
    gpsLatitude: Prisma.Decimal;
    gpsLongitude: Prisma.Decimal;
    gpsAccuracyMeters: Prisma.Decimal | null;
  }
) {
  if (!task.meter?.id) {
    return { error: 'meter_not_found' as const };
  }

  const latestState = await tx.meterState.findFirst({
    where: { meterId: task.meter.id, deletedAt: null },
    orderBy: { effectiveAt: 'desc' },
    select: {
      currentPrimary: true,
      currentSecondary: true,
    },
  });

  if (latestState?.currentPrimary && payload.primaryIndex.lessThan(latestState.currentPrimary)) {
    return { error: 'primary_index_not_monotonic' as const };
  }

  if (
    payload.secondaryIndex &&
    latestState?.currentSecondary &&
    payload.secondaryIndex.lessThan(latestState.currentSecondary)
  ) {
    return { error: 'secondary_index_not_monotonic' as const };
  }

  const reading = await tx.reading.create({
    data: {
      meterId: task.meter.id,
      submittedById: staff.id,
      reviewedById: staff.id,
      source: ReadingSource.AGENT,
      status: ReadingStatus.VALIDATED,
      readingAt: payload.readingAt,
      primaryIndex: payload.primaryIndex,
      secondaryIndex: task.meter.type === MeterType.DUAL_INDEX ? payload.secondaryIndex : null,
      imageUrl: payload.imageUrl,
      imageHash: payload.imageHash,
      imageMimeType: payload.imageMimeType,
      imageSizeBytes: payload.imageSizeBytes,
      gpsLatitude: payload.gpsLatitude,
      gpsLongitude: payload.gpsLongitude,
      gpsAccuracyMeters: payload.gpsAccuracyMeters,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      readingAt: true,
      primaryIndex: true,
      secondaryIndex: true,
      status: true,
    },
  });

  await tx.readingEvent.createMany({
    data: [
      {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.CREATED,
        payload: { source: 'agent-mobile', status: ReadingStatus.VALIDATED },
      },
      {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.SUBMITTED,
        payload: { source: 'agent-mobile' },
      },
      {
        readingId: reading.id,
        userId: staff.id,
        type: ReadingEventType.VALIDATED,
        payload: { byRole: staff.role, source: 'agent-mobile' },
      },
    ],
  });

  await tx.meterState.create({
    data: {
      meterId: task.meter.id,
      sourceReadingId: reading.id,
      previousPrimary: latestState?.currentPrimary ?? null,
      previousSecondary: latestState?.currentSecondary ?? null,
      currentPrimary: reading.primaryIndex,
      currentSecondary: reading.secondaryIndex ?? null,
      effectiveAt: reading.readingAt,
    },
  });

  if (task.readingId) {
    await tx.readingEvent.create({
      data: {
        readingId: task.readingId,
        userId: staff.id,
        type: ReadingEventType.TASK_UPDATED,
        payload: {
          action: 'agent_task_result_submitted',
          taskId: task.id,
          resolutionCode: TaskResolutionCode.READING_CONFIRMED,
          reportedReadingId: reading.id,
        },
      },
    });
  }

  return { reading };
}

export async function listAgentMobileTasks(
  staff: AgentStaff,
  options: { filter?: string | null; page?: string | null; pageSize?: string | null }
) {
  const filter = parseMissionFilter(options.filter);
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const scopedWhere = buildScopeWhere(staff.id, filter);
  const todayWhere = buildScopeWhere(staff.id, 'TODAY');
  const overdueWhere = buildScopeWhere(staff.id, 'OVERDUE');
  const inProgressWhere = buildScopeWhere(staff.id, 'IN_PROGRESS');
  const doneWhere = buildScopeWhere(staff.id, 'DONE');
  const allWhere = buildScopeWhere(staff.id, 'ALL');

  const [todayCount, overdueCount, inProgressCount, doneCount, allCount, total, tasks] = await prisma.$transaction([
    prisma.task.count({ where: todayWhere }),
    prisma.task.count({ where: overdueWhere }),
    prisma.task.count({ where: inProgressWhere }),
    prisma.task.count({ where: doneWhere }),
    prisma.task.count({ where: allWhere }),
    prisma.task.count({ where: scopedWhere }),
    prisma.task.findMany({
      where: scopedWhere,
      orderBy:
        filter === 'DONE'
          ? [{ closedAt: 'desc' }, { updatedAt: 'desc' }]
          : [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        resolutionCode: true,
        title: true,
        description: true,
        dueAt: true,
        startedAt: true,
        fieldSubmittedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        meter: {
          select: {
            id: true,
            type: true,
            serialNumber: true,
            meterReference: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            zone: true,
            ...activeMeterAssignmentCustomerSelect,
          },
        },
        reading: {
          select: {
            id: true,
            status: true,
            readingAt: true,
          },
        },
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      filter,
      summary: {
        allCount,
        todayCount,
        overdueCount,
        inProgressCount,
        doneCount,
      },
      missions: tasks.map(mapTask),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  };
}

export async function getAgentMobileTaskDetail(staff: AgentStaff, taskId: string) {
  const result = await getTaskDetail(staff, taskId);

  if (result.status !== 200 || !('task' in result.body)) {
    return result;
  }

  const task = 'task' in result.body ? result.body.task : null;
  if (!task) {
    return { status: 404, body: { error: 'task_not_found' } };
  }
  const customer = task.meter ? getActiveMeterCustomer(task.meter) : null;
  const customerName = customer
    ? formatPerson(customer.firstName, customer.lastName, undefined, customer.phone)
    : '--';
  const assignedAgentName = task.assignedTo
    ? formatPerson(task.assignedTo.firstName, task.assignedTo.lastName, task.assignedTo.username, task.assignedTo.phone)
    : '--';
  const createdByName = task.createdBy
    ? formatPerson(task.createdBy.firstName, task.createdBy.lastName, task.createdBy.username)
    : '--';
  const closedByName = task.closedBy
    ? formatPerson(task.closedBy.firstName, task.closedBy.lastName, task.closedBy.username)
    : '--';
  const startedByName = task.startedBy
    ? formatPerson(task.startedBy.firstName, task.startedBy.lastName, task.startedBy.username, task.startedBy.phone)
    : '--';

  return {
    status: 200,
    body: {
      mission: {
        id: task.id,
        type: task.type,
        status: task.status,
        priority: task.priority,
        resolutionCode: task.resolutionCode,
        title: task.title,
        description: task.description,
        resolutionComment: task.resolutionComment,
        dueAt: task.dueAt,
        startedAt: task.startedAt,
        fieldSubmittedAt: task.fieldSubmittedAt,
        closedAt: task.closedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        client: {
          id: customer?.id ?? null,
          name: customerName,
          phone: customer?.phone ?? null,
        },
        meter: {
          id: task.meter?.id ?? null,
          type: task.meter?.type ?? null,
          serialNumber: task.meter?.serialNumber ?? '--',
          meterReference: task.meter?.meterReference ?? null,
          city: task.meter?.city ?? null,
          zone: task.meter?.zone ?? null,
          addressLabel: task.meter ? formatAddressLabel(task.meter) : '--',
        },
        reading: task.reading
          ? {
              id: task.reading.id,
              status: task.reading.status,
              readingAt: task.reading.readingAt,
              primaryIndex: task.reading.primaryIndex,
              secondaryIndex: task.reading.secondaryIndex,
            }
          : null,
        reportedReading: task.reportedReading
          ? {
              id: task.reportedReading.id,
              status: task.reportedReading.status,
              readingAt: task.reportedReading.readingAt,
              primaryIndex: task.reportedReading.primaryIndex,
              secondaryIndex: task.reportedReading.secondaryIndex,
            }
          : null,
        fieldReport: task.fieldSubmittedAt
          ? {
              resolutionCode: task.resolutionCode,
              comment: task.resolutionComment,
              submittedAt: task.fieldSubmittedAt,
              startedAt: task.startedAt,
              startedByName,
              primaryIndex: task.fieldPrimaryIndex,
              secondaryIndex: task.fieldSecondaryIndex,
              imageUrl: task.fieldImageUrl,
              imageMimeType: task.fieldImageMimeType,
              imageSizeBytes: task.fieldImageSizeBytes,
              gpsLatitude: task.fieldGpsLatitude,
              gpsLongitude: task.fieldGpsLongitude,
              gpsAccuracyMeters: task.fieldGpsAccuracyMeters,
            }
          : null,
        assignedTo: {
          id: task.assignedTo?.id ?? null,
          name: assignedAgentName,
        },
        createdBy: {
          id: task.createdBy?.id ?? null,
          name: createdByName,
        },
        closedBy: {
          id: task.closedBy?.id ?? null,
          name: closedByName,
        },
        startedBy: {
          id: task.startedBy?.id ?? null,
          name: startedByName,
        },
        items: task.items,
        comments: task.comments,
        attachments: task.attachments,
        timeline: task.timeline.map((entry) => ({
          ...entry,
          at: entry.at.toISOString(),
        })),
      },
    },
  };
}

export async function startAgentMobileTask(staff: AgentStaff, taskId: string) {
  const task = (await prisma.task.findFirst({
    where: {
      id: taskId,
      assignedToId: staff.id,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      startedById: true,
      assignedToId: true,
      readingId: true,
    },
  })) as StartableTask | null;

  if (!task) {
    return { status: 404, body: { error: 'task_not_found' } };
  }

  if (isFinalTaskStatus(task.status)) {
    return { status: 409, body: { error: 'task_already_closed' } };
  }

  if (!isTaskTransitionAllowed(staff.role, task.status, TaskStatus.IN_PROGRESS) && task.status !== TaskStatus.IN_PROGRESS) {
    return { status: 409, body: { error: 'invalid_status_transition' } };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const startedTask = await tx.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: task.startedAt ?? now,
        startedById: task.startedById ?? staff.id,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        updatedAt: true,
      },
    });

    await tx.taskComment.create({
      data: {
        taskId: task.id,
        userId: staff.id,
        comment: 'Mission started from agent mobile.',
        isInternal: true,
      },
    });

    if (task.readingId) {
      await tx.readingEvent.create({
        data: {
          readingId: task.readingId,
          userId: staff.id,
          type: ReadingEventType.TASK_UPDATED,
          payload: {
            action: 'task_started_on_agent_mobile',
            taskId: task.id,
            status: TaskStatus.IN_PROGRESS,
          },
        },
      });
    }

    const agentEvent = await createAgentTaskEvent(tx, {
      taskId: task.id,
      type: TaskEventType.STARTED,
      actorUserId: staff.id,
      recipientUserId: task.assignedToId,
      payload: {
        source: 'agent-mobile',
        previousStatus: task.status,
        nextStatus: TaskStatus.IN_PROGRESS,
      },
    });

    return {
      task: startedTask,
      pushEventId: agentEvent?.id ?? null,
    };
  });

  if (updated.pushEventId) {
    await sendPushNotificationForAgentTaskEvent(updated.pushEventId);
  }

  return { status: 200, body: { message: 'task_started', task: updated.task } };
}

export async function submitAgentMobileTaskResult(staff: AgentStaff, taskId: string, payload: SubmitAgentTaskResultPayload) {
  const resolutionCode = parseResolutionCode(payload.resolutionCode);
  const comment = toNullableString(payload.comment);
  const imageUrl = toNullableString(payload.imageUrl);
  const imageHash = toNullableString(payload.imageHash);
  const imageMimeType = toNullableString(payload.imageMimeType);
  const imageSizeBytes = normalizeImageSize(payload.imageSizeBytes);
  const gpsLatitude = toDecimalInput(payload.gpsLatitude);
  const gpsLongitude = toDecimalInput(payload.gpsLongitude);
  const gpsAccuracyMeters = toDecimalInput(payload.gpsAccuracyMeters);
  const primaryIndex = toDecimalInput(payload.primaryIndex);
  const secondaryIndex = toDecimalInput(payload.secondaryIndex);
  const readingAt = parseReadingDate(payload.readingAt);

  if (!resolutionCode) {
    return { status: 400, body: { error: 'resolution_code_required' } };
  }

  if (!imageUrl || !imageMimeType) {
    return { status: 400, body: { error: 'field_photo_required' } };
  }

  if (!gpsLatitude || !gpsLongitude) {
    return { status: 400, body: { error: 'field_gps_required' } };
  }

  const task = await getAccessibleAgentTask(staff, taskId);
  if (!task || !task.meter) {
    return { status: 404, body: { error: 'task_not_found' } };
  }
  const meter = task.meter;

  if (isFinalTaskStatus(task.status)) {
    return { status: 409, body: { error: 'task_already_closed' } };
  }

  if (shouldCreateReading(resolutionCode)) {
    if (!primaryIndex || primaryIndex.lessThan(0)) {
      return { status: 400, body: { error: 'primary_index_required' } };
    }

    if (task.meter.type === MeterType.DUAL_INDEX && (!secondaryIndex || secondaryIndex.lessThan(0))) {
      return { status: 400, body: { error: 'secondary_index_required_for_dual_meter' } };
    }
  }

  const nextStatus = mapResolutionToStatus(resolutionCode);
  if (task.status !== nextStatus && !isTaskTransitionAllowed(staff.role, task.status, nextStatus)) {
    return { status: 409, body: { error: 'invalid_status_transition' } };
  }

  const submittedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    let reportedReadingId: string | null = null;

    if (shouldCreateReading(resolutionCode) && primaryIndex) {
      const readingResult = await createAgentConfirmedReading(tx, staff, task, {
        readingAt,
        primaryIndex,
        secondaryIndex: meter.type === MeterType.DUAL_INDEX ? secondaryIndex : null,
        imageUrl,
        imageHash,
        imageMimeType,
        imageSizeBytes,
        gpsLatitude,
        gpsLongitude,
        gpsAccuracyMeters,
      });

      if ('error' in readingResult) {
        return { error: readingResult.error };
      }

      reportedReadingId = readingResult.reading.id;
    }

    const updatedTask = await tx.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        startedAt: task.startedAt ?? submittedAt,
        startedById: task.startedById ?? staff.id,
        fieldSubmittedAt: submittedAt,
        resolutionCode,
        resolutionComment: comment,
        fieldPrimaryIndex: primaryIndex,
        fieldSecondaryIndex: meter.type === MeterType.DUAL_INDEX ? secondaryIndex : null,
        fieldImageUrl: imageUrl,
        fieldImageHash: imageHash,
        fieldImageMimeType: imageMimeType,
        fieldImageSizeBytes: imageSizeBytes,
        fieldGpsLatitude: gpsLatitude,
        fieldGpsLongitude: gpsLongitude,
        fieldGpsAccuracyMeters: gpsAccuracyMeters,
        reportedReadingId,
        ...(nextStatus === TaskStatus.DONE
          ? { closedAt: submittedAt, closedById: staff.id }
          : { closedAt: null, closedById: null }),
      },
      select: {
        id: true,
        status: true,
        resolutionCode: true,
        fieldSubmittedAt: true,
        reportedReadingId: true,
      },
    });

    await tx.taskAttachment.create({
      data: {
        taskId: task.id,
        uploadedById: staff.id,
        fileUrl: imageUrl,
        fileName: `mission-${task.id}-${submittedAt.getTime()}.jpg`,
        mimeType: imageMimeType,
        fileHash: imageHash,
        fileSizeBytes: imageSizeBytes,
      },
    });

    await tx.taskComment.create({
      data: {
        taskId: task.id,
        userId: staff.id,
        comment: buildMissionResultComment(resolutionCode, comment),
        isInternal: true,
      },
    });

    if (task.readingId) {
      await tx.readingEvent.create({
        data: {
          readingId: task.readingId,
          userId: staff.id,
          type: ReadingEventType.TASK_UPDATED,
          payload: {
            action: 'agent_task_result_submitted',
            taskId: task.id,
            resolutionCode,
            status: nextStatus,
            reportedReadingId,
          },
        },
      });
    }

    const agentEvent = await createAgentTaskEvent(tx, {
      taskId: task.id,
      type: TaskEventType.FIELD_RESULT_SUBMITTED,
      actorUserId: staff.id,
      recipientUserId: task.assignedToId,
      payload: {
        source: 'agent-mobile',
        previousStatus: task.status,
        nextStatus,
        resolutionCode,
        comment,
      },
    });

    return { updatedTask, pushEventId: agentEvent?.id ?? null };
  });

  if ('error' in result) {
    return { status: 409, body: { error: result.error } };
  }

  if (result.pushEventId) {
    await sendPushNotificationForAgentTaskEvent(result.pushEventId);
  }

  return {
    status: 200,
    body: {
      message: 'task_result_submitted',
      task: result.updatedTask,
    },
  };
}

export async function quickTransitionAgentMobileTask(
  staff: AgentStaff,
  taskId: string,
  nextStatusValue: string,
  comment?: string | null
) {
  const quickTransitionStatuses = [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE] as const;
  const nextStatus = Object.values(TaskStatus).includes(nextStatusValue as TaskStatus)
    ? (nextStatusValue as TaskStatus)
    : null;

  if (!nextStatus || !quickTransitionStatuses.includes(nextStatus as (typeof quickTransitionStatuses)[number])) {
    return { status: 400, body: { error: 'invalid_status_transition' } };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      assignedToId: staff.id,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      startedById: true,
      assignedToId: true,
      readingId: true,
    },
  });

  if (!task) {
    return { status: 404, body: { error: 'task_not_found' } };
  }

  if (isFinalTaskStatus(task.status) && task.status !== nextStatus) {
    return { status: 409, body: { error: 'task_already_closed' } };
  }

  if (task.status !== nextStatus && !isTaskTransitionAllowed(staff.role, task.status, nextStatus)) {
    return { status: 409, body: { error: 'invalid_status_transition' } };
  }

  if (task.status === nextStatus) {
    return {
      status: 200,
      body: {
        message: 'task_transition_applied',
        task: {
          id: task.id,
          status: task.status,
          startedAt: task.startedAt,
          closedAt: null,
          updatedAt: new Date(),
        },
      },
    };
  }

  const now = new Date();
  const internalComment = toNullableString(comment) ?? buildQuickTransitionComment(nextStatus);

  const updated = await prisma.$transaction(async (tx) => {
    const nextTask = await tx.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        startedAt:
          nextStatus === TaskStatus.IN_PROGRESS || nextStatus === TaskStatus.BLOCKED || nextStatus === TaskStatus.DONE
            ? task.startedAt ?? now
            : task.startedAt,
        startedById:
          nextStatus === TaskStatus.IN_PROGRESS || nextStatus === TaskStatus.BLOCKED || nextStatus === TaskStatus.DONE
            ? task.startedById ?? staff.id
            : task.startedById,
        ...(nextStatus === TaskStatus.DONE
          ? { closedAt: now, closedById: staff.id }
          : { closedAt: null, closedById: null }),
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    await tx.taskComment.create({
      data: {
        taskId: task.id,
        userId: staff.id,
        comment: internalComment,
        isInternal: true,
      },
    });

    if (task.readingId) {
      await tx.readingEvent.create({
        data: {
          readingId: task.readingId,
          userId: staff.id,
          type: ReadingEventType.TASK_UPDATED,
          payload: {
            action: 'agent_task_quick_transition',
            taskId: task.id,
            previousStatus: task.status,
            status: nextStatus,
            source: 'agent-mobile',
          },
        },
      });
    }

    const agentEvent = await createAgentTaskEvent(tx, {
      taskId: task.id,
      type: eventTypeForStatus(nextStatus),
      actorUserId: staff.id,
      recipientUserId: task.assignedToId,
      payload: {
        source: 'agent-mobile',
        previousStatus: task.status,
        nextStatus,
        comment: internalComment,
      },
    });

    return {
      task: nextTask,
      pushEventId: agentEvent?.id ?? null,
    };
  });

  if (updated.pushEventId) {
    await sendPushNotificationForAgentTaskEvent(updated.pushEventId);
  }

  return {
    status: 200,
    body: {
      message: 'task_transition_applied',
      task: updated.task,
    },
  };
}

export function humanizeMissionStatus(status: TaskStatus) {
  switch (status) {
    case TaskStatus.OPEN:
      return 'OPEN';
    case TaskStatus.IN_PROGRESS:
      return 'IN_PROGRESS';
    case TaskStatus.BLOCKED:
      return 'BLOCKED';
    case TaskStatus.DONE:
      return 'DONE';
    case TaskStatus.CANCELED:
      return 'CANCELED';
    default:
      return status;
  }
}

export function humanizeMissionPriority(priority: TaskPriority) {
  switch (priority) {
    case TaskPriority.LOW:
      return 'LOW';
    case TaskPriority.MEDIUM:
      return 'MEDIUM';
    case TaskPriority.HIGH:
      return 'HIGH';
    case TaskPriority.CRITICAL:
      return 'CRITICAL';
    default:
      return priority;
  }
}

export function humanizeMissionType(type: TaskType) {
  switch (type) {
    case TaskType.FIELD_RECHECK:
      return 'FIELD_RECHECK';
    case TaskType.FRAUD_INVESTIGATION:
      return 'FRAUD_INVESTIGATION';
    case TaskType.METER_VERIFICATION:
      return 'METER_VERIFICATION';
    case TaskType.GENERAL:
      return 'GENERAL';
    default:
      return type;
  }
}

export function humanizeMissionResolution(code: TaskResolutionCode) {
  switch (code) {
    case TaskResolutionCode.READING_CONFIRMED:
      return 'READING_CONFIRMED';
    case TaskResolutionCode.READING_IMPOSSIBLE:
      return 'READING_IMPOSSIBLE';
    case TaskResolutionCode.METER_INACCESSIBLE:
      return 'METER_INACCESSIBLE';
    case TaskResolutionCode.METER_DAMAGED_OR_MISSING:
      return 'METER_DAMAGED_OR_MISSING';
    case TaskResolutionCode.SUSPECTED_FRAUD:
      return 'SUSPECTED_FRAUD';
    case TaskResolutionCode.CUSTOMER_ABSENT:
      return 'CUSTOMER_ABSENT';
    case TaskResolutionCode.ESCALATION_REQUIRED:
      return 'ESCALATION_REQUIRED';
    default:
      return code;
  }
}
