"use server";

import { UserRole, UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/auth/token";

const STAFF_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);

export async function getCurrentStaffFromServerAction() {
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
