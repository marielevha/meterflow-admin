import { UserRole, UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/auth/token";

const STAFF_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);

export async function staffHasAnyPermissionFromServerComponent(
  staff: { id: string; role: UserRole },
  permissionCodes: string[],
  options?: { requireExplicitPermissions?: boolean }
) {
  const requiredPermissions = permissionCodes.filter(Boolean);
  if (requiredPermissions.length === 0) return true;

  const assignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: staff.id,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      role: {
        deletedAt: null,
        permissions: {
          some: {
            deletedAt: null,
            permission: {
              deletedAt: null,
              code: { in: requiredPermissions },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function getCurrentStaffPermissionCodes(staffId: string) {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: {
      userId: staffId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      role: { deletedAt: null },
    },
    select: {
      role: {
        select: {
          permissions: {
            where: {
              deletedAt: null,
              permission: { deletedAt: null },
            },
            select: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return [...new Set(
    assignments.flatMap((assignment) =>
      assignment.role.permissions.map((rolePermission) => rolePermission.permission.code)
    )
  )];
}

export async function getCurrentStaffFromServerComponent() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  const payload = verifySignedToken(token);
  if (!payload || payload.typ !== "access" || !payload.jti) return null;

  const session = await prisma.authSession.findFirst({
    where: {
      userId: payload.sub,
      accessTokenJti: payload.jti,
      revokedAt: null,
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
      role: { in: [...STAFF_ROLES] },
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      phone: true,
    },
  });

  return user;
}
