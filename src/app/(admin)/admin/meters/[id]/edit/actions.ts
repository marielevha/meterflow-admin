"use server";

import { MeterStatus, MeterType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
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

export async function updateMeterAction(meterId: string, formData: FormData) {
  await requireAdminPermissions(
    `/admin/meters/${meterId}/edit`,
    ADMIN_PERMISSION_GROUPS.metersEdit
  );

  const serialNumber = asString(formData.get("serialNumber"));
  const meterReference = asString(formData.get("meterReference"));
  const type = asString(formData.get("type"));
  const status = asString(formData.get("status"));
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
    redirect(`/admin/meters/${meterId}/edit?error=required_fields`);
  }

  if (!(Object.values(MeterType) as string[]).includes(type)) {
    redirect(`/admin/meters/${meterId}/edit?error=invalid_type`);
  }

  if (!(Object.values(MeterStatus) as string[]).includes(status)) {
    redirect(`/admin/meters/${meterId}/edit?error=invalid_status`);
  }

  try {
    await prisma.meter.update({
      where: { id: meterId },
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
    });
  } catch {
    redirect(`/admin/meters/${meterId}/edit?error=update_failed`);
  }

  revalidatePath("/admin/meters");
  revalidatePath(`/admin/meters/${meterId}`);
  redirect(`/admin/meters/${meterId}?updated=1`);
}
