import type { ReactNode } from "react";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";

export default async function AdminUiElementsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermissions("/admin/overview", ADMIN_PERMISSION_GROUPS.staffUtilities);
  return children;
}
