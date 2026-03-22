import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  authDurations,
  createSignedToken,
  generateOpaqueToken,
  generateTokenHash,
  verifySignedToken,
} from "@/lib/auth/token";

type RefreshPayload = {
  refreshToken: string;
  platform?: "mobile" | "web" | "agent-mobile";
};

const WEB_ALLOWED_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);
const AGENT_MOBILE_ALLOWED_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);

export async function refreshSession(payload: RefreshPayload) {
  const refreshToken = payload.refreshToken?.trim();
  const platform = payload.platform ?? "mobile";

  if (!refreshToken) {
    return { status: 400, body: { error: "refresh_token_required" } };
  }

  const tokenPayload = verifySignedToken(refreshToken);
  if (!tokenPayload || tokenPayload.typ !== "refresh" || !tokenPayload.sub) {
    return { status: 401, body: { error: "invalid_refresh_token" } };
  }

  const refreshTokenHash = generateTokenHash(refreshToken);

  const currentSession = await prisma.authSession.findFirst({
    where: {
      userId: tokenPayload.sub,
      refreshTokenHash,
      revokedAt: null,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      ...(platform ? { platform } : {}),
    },
    select: {
      id: true,
      userId: true,
      tokenFamily: true,
      deviceId: true,
      deviceName: true,
      platform: true,
      appVersion: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  if (!currentSession) {
    return { status: 401, body: { error: "session_not_found_or_revoked" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: currentSession.userId,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      region: true,
      city: true,
      zone: true,
      status: true,
      activatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return { status: 401, body: { error: "user_not_found" } };
  }

  if (
    (platform === "mobile" && user.role !== UserRole.CLIENT) ||
    (platform === "web" &&
      !WEB_ALLOWED_ROLES.has(user.role)) ||
    (platform === "agent-mobile" &&
      !AGENT_MOBILE_ALLOWED_ROLES.has(user.role))
  ) {
    return {
      status: 403,
      body: {
        error:
          platform === "mobile"
            ? "role_not_allowed_for_mobile"
            : platform === "agent-mobile"
              ? "role_not_allowed_for_agent_mobile"
              : "role_not_allowed_for_web",
      },
    };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { status: 403, body: { error: "user_not_active" } };
  }

  const { access, refresh } = authDurations();
  const accessJti = generateOpaqueToken();
  const tokenFamily = tokenPayload.fam ?? currentSession.tokenFamily ?? undefined;

  const nextRefreshToken = createSignedToken(
    {
      sub: user.id,
      role: user.role,
      typ: "refresh",
      fam: tokenFamily,
    },
    refresh
  );

  const nextAccessToken = createSignedToken(
    {
      sub: user.id,
      role: user.role,
      typ: "access",
      jti: accessJti,
    },
    access
  );

  const now = new Date();
  const nextExpiresAt = new Date(Date.now() + refresh * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.authSession.update({
      where: { id: currentSession.id },
      data: {
        revokedAt: now,
        deletedAt: now,
      },
    });

    await tx.authSession.create({
      data: {
        userId: user.id,
        tokenFamily: tokenFamily ?? null,
        refreshTokenHash: generateTokenHash(nextRefreshToken),
        accessTokenJti: accessJti,
        deviceId: currentSession.deviceId,
        deviceName: currentSession.deviceName,
        platform: currentSession.platform ?? platform,
        appVersion: currentSession.appVersion,
        ipAddress: currentSession.ipAddress,
        userAgent: currentSession.userAgent,
        expiresAt: nextExpiresAt,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });
  });

  return {
    status: 200,
    body: {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresIn: access,
      refreshTokenExpiresIn: refresh,
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        region: user.region,
        city: user.city,
        zone: user.zone,
        status: user.status,
        activatedAt: user.activatedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  };
}
