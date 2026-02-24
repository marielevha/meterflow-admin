import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { syncUserRoles } from "@/lib/backoffice/rbac";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["user:manage"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "admin_only_endpoint" }, { status: 403 });
  }

  const { id } = await context.params;
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      roleAssignments: {
        where: { deletedAt: null },
        include: { role: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      primaryRole: user.role,
      roles: user.roleAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        roleId: assignment.roleId,
        code: assignment.role.code,
        name: assignment.role.name,
      })),
    },
    { status: 200 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["user:manage"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "admin_only_endpoint" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const payload = await request.json();
    const roleIds = Array.isArray(payload?.roleIds)
      ? payload.roleIds.filter((item: unknown) => typeof item === "string")
      : null;

    if (!roleIds) {
      return NextResponse.json({ error: "role_ids_required" }, { status: 400 });
    }

    const result = await syncUserRoles({
      userId: id,
      roleIds,
      assignedById: auth.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
