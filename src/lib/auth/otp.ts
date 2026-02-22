import { createHash, randomInt } from "node:crypto";

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function otpCodeLength() {
  return Math.min(8, Math.max(4, toPositiveInt(process.env.OTP_CODE_LENGTH, 6)));
}

export function otpTtlSeconds() {
  return toPositiveInt(process.env.OTP_TTL_SECONDS, 300);
}

export function otpMaxAttempts() {
  return toPositiveInt(process.env.OTP_MAX_ATTEMPTS, 5);
}

export function generateOtpCode(length: number) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export function hashOtpCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
