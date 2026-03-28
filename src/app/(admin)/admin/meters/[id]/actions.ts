"use server";

import { MeterAssignmentSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import {
  transferMeterCustomerAssignment,
} from "@/lib/meters/assignments";
import { prisma } from "@/lib/prisma";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function displayPerson(person?: {
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  phone?: string | null;
} | null) {
  if (!person) return null;
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.phone ||
    null
  );
}

export type TransferMeterAssignmentResult =
  | { ok: true; outcome: "assigned" | "transferred"; serialNumber: string; customerName: string }
  | { ok: false; error: string; blockers?: { pendingReadings: number; activeTasks: number; draftInvoices: number } };

export async function transferMeterAssignmentAction(
  meterId: string,
  formData: FormData
): Promise<TransferMeterAssignmentResult> {
  const staff = await requireAdminPermissions(`/admin/meters/${meterId}`, ADMIN_PERMISSION_GROUPS.metersEdit);

  const customerId = asString(formData.get("customerId"));
  const notes = asString(formData.get("notes"));

  if (!customerId) {
    return { ok: false, error: "customer_required" };
  }

  const meter = await prisma.meter.findFirst({
    where: { id: meterId, deletedAt: null },
    select: {
      id: true,
      serialNumber: true,
      assignments: {
        where: { endedAt: null, deletedAt: null },
        orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          customerId: true,
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
  });

  if (!meter) {
    return { ok: false, error: "meter_not_found" };
  }

  const currentAssignment = meter.assignments[0] ?? null;
  if (currentAssignment?.customerId === customerId) {
    return { ok: false, error: "same_customer" };
  }

  try {
    await transferMeterCustomerAssignment({
      meterId,
      customerId,
      actorUserId: staff.id,
      source: MeterAssignmentSource.ADMIN,
      notes:
        notes ||
        (currentAssignment
          ? "Customer assignment transferred from admin workflow."
          : "Customer assignment created from admin workflow."),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "transfer_blocked_by_active_cycle") {
        const blockers = "blockers" in error && typeof error.blockers === "object" && error.blockers
          ? error.blockers as {
              pendingReadings: number;
              activeTasks: number;
              draftInvoices: number;
            }
          : { pendingReadings: 0, activeTasks: 0, draftInvoices: 0 };
        return {
          ok: false,
          error: "transfer_blocked_by_active_cycle",
          blockers,
        };
      }
      if (error.message === "customer_not_found") {
        return { ok: false, error: "customer_not_found" };
      }
      if (error.message === "same_customer") return { ok: false, error: "same_customer" };
    }
    return { ok: false, error: "transfer_failed" };
  }

  const customer = await prisma.user.findFirst({
    where: { id: customerId, deletedAt: null },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
    },
  });

  revalidatePath("/admin/meters");
  revalidatePath(`/admin/meters/${meterId}`);
  revalidatePath(`/admin/meters/${meterId}/edit`);

  return {
    ok: true,
    outcome: currentAssignment ? "transferred" : "assigned",
    serialNumber: meter.serialNumber,
    customerName: displayPerson(customer) || customerId,
  };
}
