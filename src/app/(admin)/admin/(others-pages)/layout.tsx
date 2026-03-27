import type { ReactNode } from "react";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";

export default async function AdminOtherPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermissions("/admin/overview", [
    ...ADMIN_PERMISSION_GROUPS.calendarView,
    ...ADMIN_PERMISSION_GROUPS.profileView,
    ...ADMIN_PERMISSION_GROUPS.showcaseView,
  ]);
  return children;
}
