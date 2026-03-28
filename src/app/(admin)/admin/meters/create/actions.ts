"use server";

import { MeterAssignmentSource, Prisma, MeterStatus, MeterType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { setMeterCustomerAssignment } from "@/lib/meters/assignments";
import { prisma } from "@/lib/prisma";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value ? value : null;
}

function nullableDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nullableDecimal(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createMeterAction(formData: FormData) {
  const staff = await requireAdminPermissions("/admin/meters/create", ADMIN_PERMISSION_GROUPS.metersCreate);

  const serialNumber = asString(formData.get("serialNumber"));
  const meterReference = asString(formData.get("meterReference"));
  const type = asString(formData.get("type"));
  const status = asString(formData.get("status"));
  const customerId = asString(formData.get("customerId"));
  const assignedAgentId = asString(formData.get("assignedAgentId"));
  const addressLine1 = asString(formData.get("addressLine1"));
  const addressLine2 = asString(formData.get("addressLine2"));
  const city = asString(formData.get("city"));
  const zone = asString(formData.get("zone"));
  const latitude = asString(formData.get("latitude"));
  const longitude = asString(formData.get("longitude"));
  const installedAt = asString(formData.get("installedAt"));
  const lastInspectionAt = asString(formData.get("lastInspectionAt"));

  if (!serialNumber) {
    redirect("/admin/meters/create?error=required_fields");
  }

  if (!(Object.values(MeterType) as string[]).includes(type)) {
    redirect("/admin/meters/create?error=invalid_type");
  }

  if (!(Object.values(MeterStatus) as string[]).includes(status)) {
    redirect("/admin/meters/create?error=invalid_status");
  }

  try {
    const meter = await prisma.meter.create({
      data: {
        serialNumber,
        meterReference: nullable(meterReference),
        type: type as MeterType,
        status: status as MeterStatus,
        assignedAgentId: nullable(assignedAgentId),
        addressLine1: nullable(addressLine1),
        addressLine2: nullable(addressLine2),
        city: nullable(city),
        zone: nullable(zone),
        latitude: nullableDecimal(latitude),
        longitude: nullableDecimal(longitude),
        installedAt: nullableDate(installedAt),
        lastInspectionAt: nullableDate(lastInspectionAt),
      },
      select: { id: true },
    });

    if (customerId) {
      await setMeterCustomerAssignment({
        meterId: meter.id,
        customerId,
        actorUserId: staff.id,
        source: MeterAssignmentSource.ADMIN,
        notes: "Initial assignment from admin meter creation.",
      });
    }

    revalidatePath("/admin/meters");
    redirect(`/admin/meters/${meter.id}?created=1`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/meters/create?error=unique_violation");
    }
    redirect("/admin/meters/create?error=create_failed");
  }
}
