"use server";

import { Prisma, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncUserRoles } from "@/lib/backoffice/rbac";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value ? value : null;
}

export async function updateUserAction(userId: string, formData: FormData) {
  const firstName = asString(formData.get("firstName"));
  const lastName = asString(formData.get("lastName"));
  const username = asString(formData.get("username"));
  const email = asString(formData.get("email")).toLowerCase();
  const phone = asString(formData.get("phone"));
  const region = asString(formData.get("region"));
  const city = asString(formData.get("city"));
  const zone = asString(formData.get("zone"));
  const roleIds = formData
    .getAll("roleIds")
    .filter((value): value is string => typeof value === "string");
  const status = asString(formData.get("status"));

  if (!phone) {
    redirect(`/admin/users/${userId}/edit?error=phone_required`);
  }

  if (!(Object.values(UserStatus) as string[]).includes(status)) {
    redirect(`/admin/users/${userId}/edit?error=invalid_status`);
  }

  const rolesSync = await syncUserRoles({
    userId,
    roleIds,
    assignedById: null,
  });
  if (!rolesSync.ok) {
    redirect(`/admin/users/${userId}/edit?error=${rolesSync.error}`);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: nullable(firstName),
        lastName: nullable(lastName),
        username: nullable(username),
        email: nullable(email),
        phone,
        region: nullable(region),
        city: nullable(city),
        zone: nullable(zone),
        status: status as UserStatus,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirect(`/admin/users/${userId}/edit?error=unique_violation`);
    }

    redirect(`/admin/users/${userId}/edit?error=update_failed`);
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?updated=1`);
}
