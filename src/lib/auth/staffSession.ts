import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/auth/token";

const STAFF_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);

type StaffAuthOptions = {
  anyOfPermissions?: string[];
  requireExplicitPermissions?: boolean;
};

function extractAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function hasAnyPermission(userId: string, permissionCodes: string[]) {
  if (permissionCodes.length === 0) return true;

  const assignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      role: {
        deletedAt: null,
        permissions: {
          some: {
            deletedAt: null,
            permission: {
              deletedAt: null,
              code: { in: permissionCodes },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function getCurrentStaffUser(request: Request, options?: StaffAuthOptions) {
  const token = extractAccessToken(request);
  if (!token) {
    return { ok: false as const, status: 401, body: { error: "unauthorized" } };
  }

  const payload = verifySignedToken(token);
  if (!payload || payload.typ !== "access" || !payload.jti) {
    return { ok: false as const, status: 401, body: { error: "invalid_token" } };
  }

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

  if (!session) {
    return { ok: false as const, status: 401, body: { error: "session_not_found_or_revoked" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      role: { in: [...STAFF_ROLES] },
      deletedAt: null,
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

  if (!user) {
    return { ok: false as const, status: 403, body: { error: "staff_only_endpoint" } };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false as const, status: 403, body: { error: "user_not_active" } };
  }

  const requiredPermissions = (options?.anyOfPermissions || []).filter(Boolean);
  if (
    requiredPermissions.length > 0 &&
    (options?.requireExplicitPermissions === true || user.role !== UserRole.ADMIN)
  ) {
    const allowed = await hasAnyPermission(user.id, requiredPermissions);
    if (!allowed) {
      return {
        ok: false as const,
        status: 403,
        body: { error: "missing_permission", requiredAnyOf: requiredPermissions },
      };
    }
  }

  return { ok: true as const, user, tokenPayload: payload };
}
