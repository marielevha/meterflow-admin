import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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
