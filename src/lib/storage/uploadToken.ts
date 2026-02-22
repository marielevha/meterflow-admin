import { createHmac } from "node:crypto";

type UploadTokenPayload = {
  userId: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  purpose: string;
  exp: number;
};

function base64Url(input: Buffer | string) {
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

function sign(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest();
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export function createUploadToken(payload: Omit<UploadTokenPayload, "exp">, ttlSeconds: number) {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: UploadTokenPayload = { ...payload, exp };

  const header = { alg: "HS256", typ: "JWT", cat: "upload" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = sign(signingInput, secret);

  return `${signingInput}.${base64Url(signature)}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload | null {
  if (!token) return null;
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expected = sign(signingInput, secret);
  const actual = fromBase64Url(encodedSignature);
  if (expected.length !== actual.length) return null;
  if (!expected.equals(actual)) return null;

  try {
    const header = JSON.parse(fromBase64Url(encodedHeader).toString("utf8")) as {
      alg?: string;
      typ?: string;
      cat?: string;
    };
    if (header.alg !== "HS256" || header.typ !== "JWT" || header.cat !== "upload") return null;
    const payload = JSON.parse(fromBase64Url(encodedBody).toString("utf8")) as UploadTokenPayload;
    if (!payload?.userId || !payload?.key || !payload?.mimeType || !payload?.sha256) return null;
    if (!payload?.sizeBytes || !payload?.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
