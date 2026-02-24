import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/auth/token";

function extractAccessToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getCurrentMobileClient(request: Request) {
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
      role: UserRole.CLIENT,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      region: true,
      city: true,
      zone: true,
      role: true,
      status: true,
      activatedAt: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return { ok: false as const, status: 403, body: { error: "client_only_endpoint" } };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false as const, status: 403, body: { error: "user_not_active" } };
  }

  return { ok: true as const, user, tokenPayload: payload };
}
