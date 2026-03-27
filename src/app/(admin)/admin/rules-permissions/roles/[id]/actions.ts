"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { syncRolePermissions } from "@/lib/backoffice/rbac";

export async function updateRolePermissionsAction(roleId: string, formData: FormData) {
  await requireAdminPermissions(
    `/admin/rules-permissions/roles/${roleId}`,
    ADMIN_PERMISSION_GROUPS.rbacManage
  );

  const permissionIds = formData
    .getAll("permissionIds")
    .filter((value): value is string => typeof value === "string");

  const result = await syncRolePermissions({ roleId, permissionIds });
  if (!result.ok) {
    redirect(`/admin/rules-permissions/roles/${roleId}?error=${result.error}`);
  }

  revalidatePath("/admin/rules-permissions");
  revalidatePath(`/admin/rules-permissions/roles/${roleId}`);
  redirect(`/admin/rules-permissions/roles/${roleId}?updated=1`);
}
