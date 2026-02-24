import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function parseDurationToSeconds(value: string, fallbackSeconds: number): number {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 3600;
  return amount * 86400;
}

export function generateTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(): string {
  return base64Url(randomBytes(48));
}

export function generateTokenFamily(): string {
  return randomUUID();
}

export function createSignedToken(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;

  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64Url(signature)}`;
}

export function authDurations() {
  const access = parseDurationToSeconds(process.env.JWT_ACCESS_TOKEN_TTL ?? "15m", 15 * 60);
  const refresh = parseDurationToSeconds(process.env.JWT_REFRESH_TOKEN_TTL ?? "30d", 30 * 86400);
  return { access, refresh };
}

export type SignedTokenPayload = {
  sub: string;
  role: string;
  typ: "access" | "refresh";
  exp: number;
  jti?: string;
  fam?: string;
};

export function verifySignedToken(token: string): SignedTokenPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signaturePart] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createHmac("sha256", secret).update(signingInput).digest();
  const receivedSignature = fromBase64Url(signaturePart);
  if (expectedSignature.length !== receivedSignature.length) return null;
  if (!timingSafeEqual(expectedSignature, receivedSignature)) return null;

  try {
    const header = JSON.parse(fromBase64Url(encodedHeader).toString("utf8")) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;

    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as SignedTokenPayload;
    if (!payload?.sub || !payload?.role || !payload?.typ || !payload?.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
