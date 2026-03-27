import { redirect } from "next/navigation";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
} from "@/lib/auth/adminPermissionGroups";
import {
  getCurrentStaffFromServerComponent,
  staffHasAnyPermissionFromServerComponent,
} from "@/lib/auth/staffServerSession";

type RequireAdminPermissionOptions = {
  requireExplicitPermissions?: boolean;
  redirectOnForbidden?: string;
};

export { ADMIN_PERMISSION_GROUPS, hasAnyPermissionCode };

export async function requireAdminPermissions(
  pathOnUnauthenticated: string,
  permissionCodes: readonly string[],
  options?: RequireAdminPermissionOptions
) {
  const staff = await getCurrentStaffFromServerComponent();
  if (!staff) {
    redirect(`/signin?next=${encodeURIComponent(pathOnUnauthenticated)}`);
  }

  const allowed = await staffHasAnyPermissionFromServerComponent(staff, [...permissionCodes], {
    requireExplicitPermissions: options?.requireExplicitPermissions,
  });

  if (!allowed) {
    redirect(options?.redirectOnForbidden ?? "/admin/overview?error=missing_permission");
  }

  return staff;
}
