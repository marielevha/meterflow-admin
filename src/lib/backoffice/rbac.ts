import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SyncRolePermissionsInput = {
  roleId: string;
  permissionIds: string[];
};

type SyncUserRolesInput = {
  userId: string;
  roleIds: string[];
  assignedById?: string | null;
};

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export async function syncRolePermissions(input: SyncRolePermissionsInput) {
  const permissionIds = uniqueIds(input.permissionIds);

  const role = await prisma.role.findFirst({
    where: { id: input.roleId, deletedAt: null },
    select: { id: true, code: true },
  });
  if (!role) {
    return { ok: false as const, status: 404, error: "role_not_found" };
  }

  const permissions = await prisma.permission.findMany({
    where: { id: { in: permissionIds }, deletedAt: null },
    select: { id: true },
  });

  if (permissions.length !== permissionIds.length) {
    return { ok: false as const, status: 400, error: "invalid_permission_ids" };
  }

  const existing = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { id: true, permissionId: true, deletedAt: true },
  });

  const existingByPermissionId = new Map(existing.map((item) => [item.permissionId, item]));
  const targetSet = new Set(permissionIds);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const permissionId of permissionIds) {
      const row = existingByPermissionId.get(permissionId);
      if (!row) {
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId },
        });
      } else if (row.deletedAt) {
        await tx.rolePermission.update({
          where: { id: row.id },
          data: { deletedAt: null },
        });
      }
    }

    for (const row of existing) {
      if (!row.deletedAt && !targetSet.has(row.permissionId)) {
        await tx.rolePermission.update({
          where: { id: row.id },
          data: { deletedAt: now },
        });
      }
    }
  });

  const activeCount = await prisma.rolePermission.count({
    where: { roleId: role.id, deletedAt: null },
  });

  return {
    ok: true as const,
    status: 200,
    data: {
      roleId: role.id,
      roleCode: role.code,
      permissionCount: activeCount,
    },
  };
}

function pickPrimaryUserRole(roleCodes: string[]): UserRole | null {
  const ordered: UserRole[] = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT, UserRole.CLIENT];
  const roleSet = new Set(roleCodes);
  for (const role of ordered) {
    if (roleSet.has(role)) return role;
  }
  return null;
}

export async function syncUserRoles(input: SyncUserRolesInput) {
  const roleIds = uniqueIds(input.roleIds);
  if (roleIds.length === 0) {
    return { ok: false as const, status: 400, error: "at_least_one_role_required" };
  }

  const user = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    return { ok: false as const, status: 404, error: "user_not_found" };
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, deletedAt: null },
    select: { id: true, code: true },
  });
  if (roles.length !== roleIds.length) {
    return { ok: false as const, status: 400, error: "invalid_role_ids" };
  }

  const existing = await prisma.userRoleAssignment.findMany({
    where: { userId: user.id },
    select: { id: true, roleId: true, deletedAt: true },
  });

  const existingByRoleId = new Map(existing.map((item) => [item.roleId, item]));
  const targetSet = new Set(roleIds);
  const now = new Date();

  const roleCodes = roles.map((r) => r.code);
  const nextPrimaryRole = pickPrimaryUserRole(roleCodes) ?? user.role;

  await prisma.$transaction(async (tx) => {
    for (const roleId of roleIds) {
      const row = existingByRoleId.get(roleId);
      if (!row) {
        await tx.userRoleAssignment.create({
          data: {
            userId: user.id,
            roleId,
            assignedById: input.assignedById ?? null,
          },
        });
      } else if (row.deletedAt) {
        await tx.userRoleAssignment.update({
          where: { id: row.id },
          data: {
            deletedAt: null,
            assignedById: input.assignedById ?? null,
          },
        });
      }
    }

    for (const row of existing) {
      if (!row.deletedAt && !targetSet.has(row.roleId)) {
        await tx.userRoleAssignment.update({
          where: { id: row.id },
          data: { deletedAt: now },
        });
      }
    }

    await tx.user.update({
      where: { id: user.id },
      data: { role: nextPrimaryRole },
    });
  });

  const activeCount = await prisma.userRoleAssignment.count({
    where: { userId: user.id, deletedAt: null },
  });

  return {
    ok: true as const,
    status: 200,
    data: {
      userId: user.id,
      assignedRoles: activeCount,
      primaryRole: nextPrimaryRole,
    },
  };
}
