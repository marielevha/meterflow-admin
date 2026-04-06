import {
  InvoiceStatus,
  MeterAssignmentSource,
  Prisma,
  ReadingStatus,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import {
  buildMeterAssignedNotification,
  buildMeterUnassignedNotification,
  createCustomerNotification,
  pushCustomerNotification,
} from "@/lib/mobile/customerNotifications";
import { prisma } from "@/lib/prisma";

const ACTIVE_ASSIGNMENT_WHERE = {
  endedAt: null,
  deletedAt: null,
} satisfies Prisma.MeterAssignmentWhereInput;

export const activeMeterAssignmentCustomerSelect = {
  assignments: {
    where: ACTIVE_ASSIGNMENT_WHERE,
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      id: true,
      customerId: true,
      assignedAt: true,
      source: true,
      notes: true,
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
          city: true,
          zone: true,
        },
      },
    },
  },
} satisfies Prisma.MeterSelect;

export type MeterWithActiveAssignment = {
  assignments?: Array<{
    id: string;
    customerId: string;
    assignedAt: Date;
    source: MeterAssignmentSource;
    notes: string | null;
    customer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      email: string | null;
      phone: string | null;
      city: string | null;
      zone: string | null;
    };
  }>;
};

export function activeAssignmentFilter(customerId: string): Prisma.MeterWhereInput {
  return {
    assignments: {
      some: {
        customerId,
        ...ACTIVE_ASSIGNMENT_WHERE,
      },
    },
  };
}

export function getActiveMeterAssignment<T extends MeterWithActiveAssignment>(meter: T) {
  return meter.assignments?.[0] ?? null;
}

export function getActiveMeterCustomer<T extends MeterWithActiveAssignment>(meter: T) {
  return getActiveMeterAssignment(meter)?.customer ?? null;
}

export async function getMeterAssignmentTransferBlockers(meterId: string) {
  const [pendingReadings, activeTasks, draftInvoices] = await prisma.$transaction([
    prisma.reading.count({
      where: {
        meterId,
        deletedAt: null,
        status: {
          in: [
            ReadingStatus.PENDING,
            ReadingStatus.FLAGGED,
            ReadingStatus.RESUBMISSION_REQUESTED,
          ],
        },
      },
    }),
    prisma.task.count({
      where: {
        meterId,
        deletedAt: null,
        status: {
          in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
      },
    }),
    prisma.invoice.count({
      where: {
        meterId,
        deletedAt: null,
        status: {
          in: [InvoiceStatus.DRAFT, InvoiceStatus.PENDING_REVIEW, InvoiceStatus.ISSUED],
        },
      },
    }),
  ]);

  return {
    pendingReadings,
    activeTasks,
    draftInvoices,
    hasBlockers: pendingReadings > 0 || activeTasks > 0 || draftInvoices > 0,
  };
}

type SetMeterAssignmentInput = {
  meterId: string;
  customerId?: string | null;
  actorUserId?: string | null;
  source: MeterAssignmentSource;
  notes?: string | null;
  allowTransfer?: boolean;
};

type SetMeterAssignmentResult =
  | {
      outcome: "unchanged";
      assignmentId: string | null;
    }
  | {
      outcome: "cleared";
      assignmentId: string | null;
    }
  | {
      outcome: "assigned";
      assignmentId: string;
    };

type SetMeterAssignmentTransactionResult = SetMeterAssignmentResult & {
  notifications: Awaited<ReturnType<typeof createCustomerNotification>>[];
};

type TransferMeterAssignmentInput = {
  meterId: string;
  customerId: string;
  actorUserId?: string | null;
  source?: MeterAssignmentSource;
  notes?: string | null;
};

export async function setMeterCustomerAssignment(
  input: SetMeterAssignmentInput
): Promise<SetMeterAssignmentResult> {
  const {
    meterId,
    customerId = null,
    actorUserId = null,
    source,
    notes = null,
    allowTransfer = true,
  } = input;

  const result: SetMeterAssignmentTransactionResult = await prisma.$transaction(async (tx) => {
    const meter = await tx.meter.findFirst({
      where: { id: meterId, deletedAt: null },
      select: { id: true, serialNumber: true },
    });

    if (!meter) {
      throw new Error("meter_not_found");
    }

    const notifications: Awaited<ReturnType<typeof createCustomerNotification>>[] = [];

    const existing = await tx.meterAssignment.findFirst({
      where: {
        meterId,
        ...ACTIVE_ASSIGNMENT_WHERE,
      },
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        customerId: true,
      },
    });

    if (!customerId) {
      if (!existing) {
        return { outcome: "unchanged", assignmentId: null, notifications };
      }

      await tx.meterAssignment.update({
        where: { id: existing.id },
        data: {
          endedAt: new Date(),
          endedById: actorUserId,
        },
      });

      if (!(source === MeterAssignmentSource.MOBILE_CLAIM && actorUserId === existing.customerId)) {
        notifications.push(
          await createCustomerNotification(
            tx,
            buildMeterUnassignedNotification({
              userId: existing.customerId,
              meterId,
              meterSerialNumber: meter.serialNumber,
              source,
            })
          )
        );
      }

      return { outcome: "cleared", assignmentId: null, notifications };
    }

    const customer = await tx.user.findFirst({
      where: {
        id: customerId,
        role: UserRole.CLIENT,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!customer) {
      throw new Error("customer_not_found");
    }

    if (existing?.customerId === customerId) {
      return { outcome: "unchanged", assignmentId: existing.id, notifications };
    }

    if (existing && !allowTransfer) {
      throw new Error("meter_already_assigned");
    }

    if (existing) {
      await tx.meterAssignment.update({
        where: { id: existing.id },
        data: {
          endedAt: new Date(),
          endedById: actorUserId,
        },
      });

      if (!(source === MeterAssignmentSource.MOBILE_CLAIM && actorUserId === existing.customerId)) {
        notifications.push(
          await createCustomerNotification(
            tx,
            buildMeterUnassignedNotification({
              userId: existing.customerId,
              meterId,
              meterSerialNumber: meter.serialNumber,
              source,
            })
          )
        );
      }
    }

    const created = await tx.meterAssignment.create({
      data: {
        meterId,
        customerId,
        assignedById: actorUserId,
        source,
        notes,
      },
      select: { id: true },
    });

    if (!(source === MeterAssignmentSource.MOBILE_CLAIM && actorUserId === customerId)) {
      notifications.push(
        await createCustomerNotification(
          tx,
          buildMeterAssignedNotification({
            userId: customerId,
            meterId,
            meterSerialNumber: meter.serialNumber,
            source,
          })
        )
      );
    }

    return { outcome: "assigned", assignmentId: created.id, notifications };
  });

  await Promise.all(result.notifications.map((notification) => pushCustomerNotification(notification)));

  if (result.outcome === "assigned") {
    return {
      outcome: "assigned",
      assignmentId: result.assignmentId,
    };
  }

  if (result.outcome === "cleared") {
    return {
      outcome: "cleared",
      assignmentId: null,
    };
  }

  return {
    outcome: "unchanged",
    assignmentId: result.assignmentId,
  };
}

export async function transferMeterCustomerAssignment(input: TransferMeterAssignmentInput) {
  const {
    meterId,
    customerId,
    actorUserId = null,
    source = MeterAssignmentSource.ADMIN,
    notes = null,
  } = input;

  const activeAssignment = await prisma.meterAssignment.findFirst({
    where: {
      meterId,
      endedAt: null,
      deletedAt: null,
    },
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerId: true,
    },
  });

  if (activeAssignment?.customerId === customerId) {
    throw new Error("same_customer");
  }

  const blockers = await getMeterAssignmentTransferBlockers(meterId);
  if (blockers.hasBlockers) {
    const error = new Error("transfer_blocked_by_active_cycle");
    Object.assign(error, { blockers });
    throw error;
  }

  const result = await setMeterCustomerAssignment({
    meterId,
    customerId,
    actorUserId,
    source,
    notes,
    allowTransfer: true,
  });

  return {
    outcome: activeAssignment ? "transferred" : "assigned",
    assignmentId: result.assignmentId,
  };
}
