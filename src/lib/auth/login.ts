import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  authDurations,
  createSignedToken,
  generateOpaqueToken,
  generateTokenFamily,
  generateTokenHash,
} from "@/lib/auth/token";

type LoginPlatform = "web" | "mobile";
type LoginIdentifierType = "phone" | "email" | "username";

type LoginPayload = {
  identifier: string;
  password: string;
  platform?: LoginPlatform;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
};

type LoginOptions = {
  allowedIdentifiers?: LoginIdentifierType[];
};

const WEB_ALLOWED_ROLES = new Set<UserRole>([
  UserRole.AGENT,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
]);
const MOBILE_ALLOWED_ROLES = new Set<UserRole>([UserRole.CLIENT]);

function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

function buildIdentifierWhere(
  identifier: string,
  allowedIdentifiers: LoginIdentifierType[]
): Prisma.UserWhereInput[] {
  const trimmedIdentifier = identifier.trim();
  const normalizedEmail = trimmedIdentifier.toLowerCase();

  return allowedIdentifiers.map((type) => {
    if (type === "email") {
      return { email: normalizedEmail };
    }
    if (type === "username") {
      return { username: trimmedIdentifier };
    }
    return { phone: trimmedIdentifier };
  });
}

export async function loginUser(payload: LoginPayload, options?: LoginOptions) {
  const identifier = normalizeIdentifier(payload.identifier);
  const platform: LoginPlatform = payload.platform ?? "mobile";
  const allowedIdentifiers =
    options?.allowedIdentifiers ?? ["phone", "email", "username"];

  if (!identifier || !payload.password) {
    return { status: 400, body: { error: "identifier_and_password_required" } };
  }

  if (allowedIdentifiers.length === 0) {
    return { status: 400, body: { error: "identifier_not_supported" } };
  }

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: buildIdentifierWhere(identifier, allowedIdentifiers),
    },
  });

  if (!user || !user.passwordHash || !verifyPassword(payload.password, user.passwordHash)) {
    return { status: 401, body: { error: "invalid_credentials" } };
  }

  if (platform === "web" && !WEB_ALLOWED_ROLES.has(user.role)) {
    return { status: 403, body: { error: "role_not_allowed_for_web" } };
  }

  if (platform === "mobile" && !MOBILE_ALLOWED_ROLES.has(user.role)) {
    return { status: 403, body: { error: "role_not_allowed_for_mobile" } };
  }

  if (user.status !== "ACTIVE") {
    return { status: 403, body: { error: "user_not_active" } };
  }

  const { access, refresh } = authDurations();
  const tokenFamily = generateTokenFamily();
  const accessJti = generateOpaqueToken();
  const refreshToken = createSignedToken(
    {
      sub: user.id,
      role: user.role,
      typ: "refresh",
      fam: tokenFamily,
    },
    refresh
  );
  const accessToken = createSignedToken(
    {
      sub: user.id,
      role: user.role,
      typ: "access",
      jti: accessJti,
    },
    access
  );

  const expiresAt = new Date(Date.now() + refresh * 1000);

  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenFamily,
      accessTokenJti: accessJti,
      refreshTokenHash: generateTokenHash(refreshToken),
      deviceId: payload.deviceId,
      deviceName: payload.deviceName,
      appVersion: payload.appVersion,
      platform,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    status: 200,
    body: {
      accessToken,
      refreshToken,
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
