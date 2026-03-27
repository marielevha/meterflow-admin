import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissions";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { syncRolePermissions } from "@/lib/backoffice/rbac";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.rbacView],
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  const role = await prisma.role.findFirst({
    where: { id, deletedAt: null },
    include: {
      permissions: {
        where: { deletedAt: null },
        include: { permission: true },
      },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "role_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: role.id,
      code: role.code,
      name: role.name,
      permissions: role.permissions.map((rp) => ({
        rolePermissionId: rp.id,
        permissionId: rp.permissionId,
        code: rp.permission.code,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
      })),
    },
    { status: 200 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: [...ADMIN_PERMISSION_GROUPS.rbacManage],
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    const payload = await request.json();
    const permissionIds = Array.isArray(payload?.permissionIds)
      ? payload.permissionIds.filter((item: unknown) => typeof item === "string")
      : null;

    if (!permissionIds) {
      return NextResponse.json({ error: "permission_ids_required" }, { status: 400 });
    }

    const result = await syncRolePermissions({ roleId: id, permissionIds });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
