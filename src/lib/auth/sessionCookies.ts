function parseBooleanEnv(value: string | undefined) {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  return null;
}

export function shouldUseSecureSessionCookies(request: Request) {
  const explicitSecure = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE);
  if (explicitSecure !== null) {
    return explicitSecure;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export function buildSessionCookieOptions(
  request: Request,
  options?: {
    maxAge?: number;
  }
) {
  return {
    httpOnly: true,
    secure: shouldUseSecureSessionCookies(request),
    sameSite: "lax" as const,
    path: "/",
    ...(options?.maxAge !== undefined ? { maxAge: options.maxAge } : {}),
  };
}
